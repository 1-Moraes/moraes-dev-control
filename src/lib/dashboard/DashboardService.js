// DashboardService — Fase 2F do planejamento.
//
// Camada de AGREGAÇÃO DE LEITURA para o Dashboard operacional. Deliberadamente
// fina: não reimplementa nenhuma regra de negócio que já existe em
// LeadsService/ClientsService/ProjectsService (reaproveita STATUS_PIPELINE,
// STATUS_PROJETO_LABEL, STATUS_TAREFA_LABEL, calcularSituacaoPrazo), e não
// contém nenhuma lógica visual — isso fica nos componentes de
// src/components/dashboard/.
//
// Regra de ouro do item 3 do planejamento: ZERO dado inventado. Toda função
// aqui lê do Supabase de verdade; quando não há dados, devolve array/objeto
// vazio — a UI decide o "estado vazio", esta camada nunca decide um número.
//
// Consultas propositalmente pequenas e com LIMIT (item "performance"): nada
// aqui faz N+1 (um select por seção, no máximo com um join simples), e cada
// função é independente para que uma falha numa seção não derrube as outras
// (o Dashboard.jsx chama cada uma em try/catch separado).

import { supabase } from '../supabaseClient'
import { STATUS_PIPELINE } from '../crm/LeadsService'
import { STATUS_PROJETO_LABEL, STATUS_TAREFA_LABEL, calcularSituacaoPrazo } from '../projects/ProjectsService'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase não configurado nesta sessão.')
}

async function obterUsuarioAtualId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

// Status "fechados" do pipeline comercial e de projeto — excluídos das
// contagens de "ativos" (regra documentada no relatório final da Fase 2F).
const STATUS_LEAD_FECHADOS = ['ganho', 'perdido']
const STATUS_PROJETO_FECHADOS = ['finalizado', 'cancelado']

// ----------------------------------------------------------------------------
// Saudação contextual (item "cabeçalho de boas-vindas")
// ----------------------------------------------------------------------------
export function obterSaudacaoPorHorario(data = new Date()) {
  const hora = data.getHours()
  if (hora < 5) return 'Boa madrugada'
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

// ----------------------------------------------------------------------------
// KPIs — regras documentadas aqui porque dependem dos valores reais de
// status encontrados no schema (ver leads.status/clients.status/
// projects.status em supabase/schema.sql):
//
//   Leads ativos      = leads.status NOT IN ('ganho', 'perdido')
//   Clientes ativos    = clients.status = 'ativo'
//   Projetos ativos    = projects.status NOT IN ('finalizado', 'cancelado')
//                         (inclui 'pausado' — contrato ainda vigente, só
//                         temporariamente parado; aparece também no painel
//                         de atenção, não como "ativo" enganoso)
//   Valor contratado   = soma de projects.valor_contratado dos projetos
//                         ativos (regra acima). Nome é literal "Valor
//                         contratado" — NUNCA Receita/Faturamento/Recebido/
//                         Lucro, porque não existe módulo financeiro nesta
//                         fase (sem controle de parcelas pagas).
// ----------------------------------------------------------------------------
export async function obterMetricas() {
  requireSupabase()

  const [leadsRes, clientsRes, projectsRes] = await Promise.all([
    supabase.from('leads').select('status'),
    supabase.from('clients').select('status'),
    supabase.from('projects').select('status, valor_contratado'),
  ])
  if (leadsRes.error) throw leadsRes.error
  if (clientsRes.error) throw clientsRes.error
  if (projectsRes.error) throw projectsRes.error

  const leads = leadsRes.data || []
  const clients = clientsRes.data || []
  const projects = projectsRes.data || []

  const projetosAtivos = projects.filter((p) => !STATUS_PROJETO_FECHADOS.includes(p.status))

  return {
    leadsAtivos: leads.filter((l) => !STATUS_LEAD_FECHADOS.includes(l.status)).length,
    clientesAtivos: clients.filter((c) => c.status === 'ativo').length,
    projetosAtivos: projetosAtivos.length,
    valorContratado: projetosAtivos.reduce((soma, p) => soma + Number(p.valor_contratado || 0), 0),
  }
}

// ----------------------------------------------------------------------------
// Pipeline comercial — contagem real por estágio (reaproveita a ordem/labels
// de STATUS_PIPELINE do LeadsService, não duplica). Sem biblioteca de
// gráfico: a UI desenha barras com CSS puro a partir dessas contagens.
// ----------------------------------------------------------------------------
export async function obterPipeline() {
  requireSupabase()
  const { data, error } = await supabase.from('leads').select('status')
  if (error) throw error

  const contagem = Object.fromEntries(STATUS_PIPELINE.map((s) => [s.valor, 0]))
  for (const lead of data || []) {
    if (contagem[lead.status] !== undefined) contagem[lead.status] += 1
  }

  return STATUS_PIPELINE.map((s) => ({ valor: s.valor, label: s.label, quantidade: contagem[s.valor] }))
}

// ----------------------------------------------------------------------------
// "Precisa da sua atenção" — une 3 fontes reais (próxima ação de lead
// atrasada, projeto atrasado, tarefa atrasada) num único feed priorizado:
// atrasado > hoje > próximo > informativo. Reaproveita calcularSituacaoPrazo
// do ProjectsService (mesma função usada no Painel de Projeto, Fase 2E) em
// vez de recalcular datas de outro jeito.
// ----------------------------------------------------------------------------
function situacaoAcaoLead(dataIso) {
  if (!dataIso) return 'informativo'
  const agora = new Date()
  const data = new Date(dataIso)
  const diffHoras = (data.getTime() - agora.getTime()) / (1000 * 60 * 60)
  if (diffHoras < 0) return 'atrasado'
  if (diffHoras <= 24) return 'hoje'
  if (diffHoras <= 72) return 'proximo'
  return 'informativo'
}

const PESO_SEVERIDADE = { atrasado: 0, hoje: 1, proximo: 2, informativo: 3 }

export async function obterItensAtencao() {
  requireSupabase()

  const [leadsRes, projectsRes, tasksRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id, nome_empresa, proxima_acao_tipo, proxima_acao_data, proxima_acao_descricao, status')
      .not('proxima_acao_data', 'is', null)
      .not('status', 'in', `(${STATUS_LEAD_FECHADOS.join(',')})`)
      .order('proxima_acao_data', { ascending: true })
      .limit(30),
    supabase
      .from('projects')
      .select('id, nome, prazo_previsto, status, cliente:clients!projects_client_id_fkey(nome_empresa)')
      .not('status', 'in', `(${STATUS_PROJETO_FECHADOS.join(',')})`)
      .limit(50),
    supabase
      .from('project_tasks')
      .select('id, titulo, prazo, status, project:projects!project_tasks_project_id_fkey(id, nome)')
      .neq('status', 'concluida')
      .not('prazo', 'is', null)
      .limit(50),
  ])
  if (leadsRes.error) throw leadsRes.error
  if (projectsRes.error) throw projectsRes.error
  if (tasksRes.error) throw tasksRes.error

  const itens = []

  for (const lead of leadsRes.data || []) {
    const severidade = situacaoAcaoLead(lead.proxima_acao_data)
    itens.push({
      id: `lead-${lead.id}`,
      tipo: 'lead',
      severidade,
      titulo: lead.nome_empresa,
      subtitulo: lead.proxima_acao_descricao || `Próxima ação: ${lead.proxima_acao_tipo || 'a definir'}`,
      data: lead.proxima_acao_data,
      link: `/dashboard/crm?lead=${lead.id}`,
    })
  }

  for (const projeto of projectsRes.data || []) {
    const { situacao } = calcularSituacaoPrazo(projeto.prazo_previsto, projeto.status)
    if (situacao !== 'atrasado' && situacao !== 'proximo') continue
    itens.push({
      id: `projeto-${projeto.id}`,
      tipo: 'projeto',
      severidade: situacao === 'atrasado' ? 'atrasado' : 'proximo',
      titulo: projeto.nome,
      subtitulo: `${projeto.cliente?.nome_empresa || 'Cliente'} · ${STATUS_PROJETO_LABEL[projeto.status] || projeto.status}`,
      data: projeto.prazo_previsto,
      link: `/dashboard/projetos?projeto=${projeto.id}`,
    })
  }

  const hojeISO = new Date().toISOString().slice(0, 10)
  for (const tarefa of tasksRes.data || []) {
    if (!tarefa.prazo || tarefa.prazo >= hojeISO) continue
    itens.push({
      id: `tarefa-${tarefa.id}`,
      tipo: 'tarefa',
      severidade: 'atrasado',
      titulo: tarefa.titulo,
      subtitulo: `Tarefa do projeto ${tarefa.project?.nome || '—'}`,
      data: tarefa.prazo,
      link: tarefa.project?.id ? `/dashboard/projetos?projeto=${tarefa.project.id}` : null,
    })
  }

  itens.sort((a, b) => (PESO_SEVERIDADE[a.severidade] ?? 9) - (PESO_SEVERIDADE[b.severidade] ?? 9))
  return itens
}

// ----------------------------------------------------------------------------
// "Próximas ações" — mesmos campos de leads.proxima_acao_*, mas aqui a lente
// é "o que fazer a seguir" (ordem cronológica simples), não priorização por
// urgência como no painel de atenção acima.
// ----------------------------------------------------------------------------
export async function obterProximasAcoes({ limite = 8 } = {}) {
  requireSupabase()
  const { data, error } = await supabase
    .from('leads')
    .select('id, nome_empresa, telefone, whatsapp, proxima_acao_tipo, proxima_acao_data, proxima_acao_descricao, status')
    .not('proxima_acao_data', 'is', null)
    .not('status', 'in', `(${STATUS_LEAD_FECHADOS.join(',')})`)
    .order('proxima_acao_data', { ascending: true })
    .limit(limite)
  if (error) throw error

  return (data || []).map((lead) => ({
    id: lead.id,
    nome: lead.nome_empresa,
    tipo: lead.proxima_acao_tipo,
    data: lead.proxima_acao_data,
    descricao: lead.proxima_acao_descricao,
    telefone: lead.whatsapp || lead.telefone || null,
    severidade: situacaoAcaoLead(lead.proxima_acao_data),
    link: `/dashboard/crm?lead=${lead.id}`,
  }))
}

// ----------------------------------------------------------------------------
// "Projetos em andamento" — resumo dos projetos ativos, já com a situação de
// prazo calculada (reaproveitando calcularSituacaoPrazo).
// ----------------------------------------------------------------------------
export async function obterProjetosResumo({ limite = 8 } = {}) {
  requireSupabase()
  const { data, error } = await supabase
    .from('projects')
    .select('id, nome, status, prazo_previsto, cliente:clients!projects_client_id_fkey(nome_empresa)')
    .not('status', 'in', `(${STATUS_PROJETO_FECHADOS.join(',')})`)
    .order('updated_at', { ascending: false })
    .limit(limite)
  if (error) throw error

  return (data || []).map((projeto) => ({
    id: projeto.id,
    nome: projeto.nome,
    cliente: projeto.cliente?.nome_empresa || null,
    status: projeto.status,
    statusLabel: STATUS_PROJETO_LABEL[projeto.status] || projeto.status,
    prazoPrevisto: projeto.prazo_previsto,
    situacaoPrazo: calcularSituacaoPrazo(projeto.prazo_previsto, projeto.status).situacao,
    link: `/dashboard/projetos?projeto=${projeto.id}`,
  }))
}

// ----------------------------------------------------------------------------
// "Tarefas" — resumo agregado (reaproveita project_tasks, não cria nenhum
// sistema de tarefas novo).
// ----------------------------------------------------------------------------
export async function obterTarefasResumo() {
  requireSupabase()
  const { data, error } = await supabase
    .from('project_tasks')
    .select('id, titulo, status, prazo, project:projects!project_tasks_project_id_fkey(id, nome)')
  if (error) throw error

  const tarefas = data || []
  const porStatus = Object.fromEntries(Object.keys(STATUS_TAREFA_LABEL).map((s) => [s, 0]))
  for (const t of tarefas) {
    if (porStatus[t.status] !== undefined) porStatus[t.status] += 1
  }

  const hojeISO = new Date().toISOString().slice(0, 10)
  const atrasadas = tarefas
    .filter((t) => t.status !== 'concluida' && t.prazo && t.prazo < hojeISO)
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      projeto: t.project?.nome || null,
      prazo: t.prazo,
      link: t.project?.id ? `/dashboard/projetos?projeto=${t.project.id}` : null,
    }))

  return {
    total: tarefas.length,
    porStatus: Object.entries(porStatus).map(([valor, quantidade]) => ({ valor, label: STATUS_TAREFA_LABEL[valor], quantidade })),
    atrasadas,
  }
}

// ----------------------------------------------------------------------------
// "Atividade recente" — feed mesclado de lead_activities + project_activities
// + audit_logs, cada um já limitado na própria query (nunca uma query gigante
// sem limite). Mapeamento de entidade→link usa os MESMOS padrões de
// deep-link já existentes no app (/dashboard/crm|clientes|projetos?...=id).
// ----------------------------------------------------------------------------
export async function obterAtividadeRecente({ limite = 8 } = {}) {
  requireSupabase()

  const [leadAct, projetoAct, auditLog] = await Promise.all([
    supabase
      .from('lead_activities')
      .select('id, detalhe, tipo, created_at, lead_id, lead:leads!lead_activities_lead_id_fkey(nome_empresa), autor:profiles(nome)')
      .order('created_at', { ascending: false })
      .limit(limite),
    supabase
      .from('project_activities')
      .select('id, descricao, created_at, project_id, project:projects!project_activities_project_id_fkey(nome), autor:profiles(nome)')
      .order('created_at', { ascending: false })
      .limit(limite),
    supabase
      .from('audit_logs')
      .select('id, acao, entidade_tipo, entidade_id, created_at, usuario:profiles(nome)')
      .order('created_at', { ascending: false })
      .limit(limite),
  ])
  if (leadAct.error) throw leadAct.error
  if (projetoAct.error) throw projetoAct.error
  if (auditLog.error) throw auditLog.error

  const eventos = []

  for (const a of leadAct.data || []) {
    eventos.push({
      id: `lead_activity-${a.id}`,
      descricao: a.detalhe || `Atividade: ${a.tipo}`,
      contexto: a.lead?.nome_empresa || 'Lead',
      autor: a.autor?.nome || 'Equipe',
      createdAt: a.created_at,
      link: `/dashboard/crm?lead=${a.lead_id}`,
    })
  }

  for (const a of projetoAct.data || []) {
    eventos.push({
      id: `project_activity-${a.id}`,
      descricao: a.descricao,
      contexto: a.project?.nome || 'Projeto',
      autor: a.autor?.nome || 'Equipe',
      createdAt: a.created_at,
      link: `/dashboard/projetos?projeto=${a.project_id}`,
    })
  }

  const LINK_POR_ENTIDADE = { lead: 'crm?lead=', cliente: 'clientes?cliente=', projeto: 'projetos?projeto=' }
  for (const a of auditLog.data || []) {
    const prefixoLink = a.entidade_id ? LINK_POR_ENTIDADE[a.entidade_tipo] : null
    eventos.push({
      id: `audit-${a.id}`,
      // a.acao vem em formato 'entidade.evento' (ex.: 'lead.criado') — troca
      // o ponto por espaço só pra leitura, sem tentar traduzir/mapear um
      // texto livre de auditoria (seria inventar um label que não existe).
      descricao: String(a.acao || '').replace('.', ' · '),
      contexto: a.entidade_tipo || null,
      autor: a.usuario?.nome || 'Equipe',
      createdAt: a.created_at,
      link: prefixoLink ? `/dashboard/${prefixoLink}${a.entidade_id}` : null,
    })
  }

  eventos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return eventos.slice(0, limite)
}

// ----------------------------------------------------------------------------
// "Acessos rápidos" — CRUD simples sobre user_shortcuts (migration
// 0005_fase_2f_dashboard_prospeccao.sql). Validação de URL é feita aqui
// também (defesa em profundidade — a UI já valida antes de chamar), nunca
// confiando só no formulário.
// ----------------------------------------------------------------------------
export function validarUrlAtalho(url) {
  if (!url || typeof url !== 'string') return false
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function listarAtalhos() {
  requireSupabase()
  const usuarioId = await obterUsuarioAtualId()
  if (!usuarioId) return []
  const { data, error } = await supabase
    .from('user_shortcuts')
    .select('*')
    .eq('profile_id', usuarioId)
    .eq('ativo', true)
    .order('ordem', { ascending: true })
  if (error) throw error
  return data || []
}

export async function criarAtalho({ nome, url, icone }) {
  requireSupabase()
  if (!validarUrlAtalho(url)) throw new Error('URL inválida — use um link http:// ou https:// completo.')
  const usuarioId = await obterUsuarioAtualId()
  if (!usuarioId) throw new Error('Sem sessão ativa.')

  const { data: existentes } = await supabase.from('user_shortcuts').select('ordem').eq('profile_id', usuarioId)
  const proximaOrdem = (existentes || []).reduce((max, a) => Math.max(max, a.ordem), -1) + 1

  const { data, error } = await supabase
    .from('user_shortcuts')
    .insert({ profile_id: usuarioId, nome: nome.trim(), url: url.trim(), icone: icone || null, ordem: proximaOrdem })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarAtalho(id, patch) {
  requireSupabase()
  if (patch.url !== undefined && !validarUrlAtalho(patch.url)) {
    throw new Error('URL inválida — use um link http:// ou https:// completo.')
  }
  const { data, error } = await supabase.from('user_shortcuts').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function excluirAtalho(id) {
  requireSupabase()
  const { error } = await supabase.from('user_shortcuts').delete().eq('id', id)
  if (error) throw error
}

// Reordenação simples (setas subir/descer na UI, não é drag-and-drop) — troca
// a `ordem` dos dois atalhos envolvidos.
export async function trocarOrdemAtalhos(atalhoA, atalhoB) {
  requireSupabase()
  const [resA, resB] = await Promise.all([
    supabase.from('user_shortcuts').update({ ordem: atalhoB.ordem }).eq('id', atalhoA.id),
    supabase.from('user_shortcuts').update({ ordem: atalhoA.ordem }).eq('id', atalhoB.id),
  ])
  if (resA.error) throw resA.error
  if (resB.error) throw resB.error
}
