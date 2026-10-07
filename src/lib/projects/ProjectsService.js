// ProjectsService — camada de dados de Projetos (Fase 2D criou o registro
// inicial; Fase 2E transforma em central operacional: etapas, tarefas,
// briefing, arquivos, links, infraestrutura, alterações solicitadas,
// deploys e histórico). Mesma fronteira do LeadsService/ClientsService:
// único lugar que fala com projects/project_tasks/project_files/
// project_links/project_change_requests/project_deploys/project_activities/
// services no Supabase.

import { supabase } from '../supabaseClient'

// Ordem real do fluxo operacional (Fase 2E, item 2). "pausado"/"cancelado"
// são estados complementares — não entram na timeline sequencial, só no
// Kanban/filtros.
export const ETAPAS_PROJETO = [
  { valor: 'contratado', label: 'Contratado' },
  { valor: 'briefing', label: 'Briefing' },
  { valor: 'planejamento', label: 'Planejamento' },
  { valor: 'design', label: 'Design' },
  { valor: 'desenvolvimento', label: 'Desenvolvimento' },
  { valor: 'homologacao', label: 'Homologação' },
  { valor: 'ajustes', label: 'Ajustes' },
  { valor: 'publicacao', label: 'Publicação' },
  { valor: 'finalizado', label: 'Finalizado' },
]

export const STATUS_PROJETO = [...ETAPAS_PROJETO, { valor: 'pausado', label: 'Pausado' }, { valor: 'cancelado', label: 'Cancelado' }]

export const STATUS_PROJETO_LABEL = Object.fromEntries(STATUS_PROJETO.map((s) => [s.valor, s.label]))

export const PRIORIDADES_PROJETO = [
  { valor: 'baixa', label: 'Baixa' },
  { valor: 'media', label: 'Média' },
  { valor: 'alta', label: 'Alta' },
]

export const STATUS_TAREFA = [
  { valor: 'a_fazer', label: 'A fazer' },
  { valor: 'em_andamento', label: 'Em andamento' },
  { valor: 'concluida', label: 'Concluída' },
  { valor: 'bloqueada', label: 'Bloqueada' },
]
export const STATUS_TAREFA_LABEL = Object.fromEntries(STATUS_TAREFA.map((s) => [s.valor, s.label]))

export const TIPOS_LINK = [
  { valor: 'producao', label: 'Produção' },
  { valor: 'homologacao', label: 'Homologação' },
  { valor: 'figma', label: 'Figma' },
  { valor: 'github', label: 'GitHub' },
  { valor: 'vercel', label: 'Vercel' },
  { valor: 'dominio', label: 'Domínio' },
  { valor: 'hospedagem', label: 'Hospedagem' },
  { valor: 'outro', label: 'Outro' },
]

export const STATUS_ALTERACAO = [
  { valor: 'aberta', label: 'Aberta' },
  { valor: 'em_andamento', label: 'Em andamento' },
  { valor: 'concluida', label: 'Concluída' },
  { valor: 'cancelada', label: 'Cancelada' },
]
export const STATUS_ALTERACAO_LABEL = Object.fromEntries(STATUS_ALTERACAO.map((s) => [s.valor, s.label]))

export const AMBIENTES_DEPLOY = [
  { valor: 'homologacao', label: 'Homologação' },
  { valor: 'producao', label: 'Produção' },
  { valor: 'outro', label: 'Outro' },
]

// Campos genéricos de briefing (item 28/29 — estrutura genérica agora,
// preparada para no futuro variar por tipo de serviço sem engine dinâmica).
export const CAMPOS_BRIEFING = [
  { chave: 'objetivo', label: 'Objetivo' },
  { chave: 'publico_alvo', label: 'Público-alvo' },
  { chave: 'referencias', label: 'Referências' },
  { chave: 'identidade_visual', label: 'Identidade visual' },
  { chave: 'conteudo_disponivel', label: 'Conteúdo disponível' },
  { chave: 'paginas_secoes', label: 'Páginas/seções' },
  { chave: 'funcionalidades', label: 'Funcionalidades' },
  { chave: 'observacoes', label: 'Observações' },
]

const SELECT_PROJETO_COMPLETO = `
  *,
  cliente:clients!projects_client_id_fkey ( id, nome_empresa, telefone, whatsapp, email, cidade, estado ),
  servico:services!projects_service_id_fkey ( id, nome ),
  responsavel:profiles!projects_responsavel_id_fkey ( id, nome, avatar_url ),
  lead_origem:leads!projects_origin_lead_id_fkey ( id, nome_empresa )
`

function requireSupabase() {
  if (!supabase) throw new Error('Supabase não configurado nesta sessão.')
}

async function obterUsuarioAtualId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

async function registrarAtividadeInterno(projectId, descricao, autorId) {
  const { error } = await supabase.from('project_activities').insert({ project_id: projectId, descricao, autor_id: autorId })
  if (error) throw error
}

export async function registrarAtividade(projectId, descricao) {
  requireSupabase()
  const usuarioId = await obterUsuarioAtualId()
  await registrarAtividadeInterno(projectId, descricao, usuarioId)
}

export async function listarMembrosEquipe() {
  requireSupabase()
  const { data, error } = await supabase.from('profiles').select('id, nome, avatar_url').eq('ativo', true).order('nome')
  if (error) throw error
  return data || []
}

export async function listarServicos() {
  requireSupabase()
  const { data, error } = await supabase.from('services').select('id, nome, descricao').order('nome')
  if (error) throw error
  return data || []
}

export async function listarProjetos() {
  requireSupabase()
  const { data, error } = await supabase.from('projects').select(SELECT_PROJETO_COMPLETO).order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function listarProjetosDoCliente(clientId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('projects')
    .select(SELECT_PROJETO_COMPLETO)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function buscarProjeto(id) {
  requireSupabase()
  const { data, error } = await supabase.from('projects').select(SELECT_PROJETO_COMPLETO).eq('id', id).single()
  if (error) throw error
  return data
}

export async function listarAtividadesProjeto(projectId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('project_activities')
    .select('*, autor:profiles ( id, nome, avatar_url )')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Cria o projeto inicial. Sempre com client_id preenchido; origin_lead_id
 * só quando o cliente veio de uma conversão de lead. Sem deduplicação
 * agressiva: dois cliques podem representar dois projetos reais
 * diferentes — a proteção aqui é só contra double-submit acidental, feita
 * na UI (botão loading/disabled).
 */
export async function criarProjeto(dados) {
  requireSupabase()
  const usuarioId = await obterUsuarioAtualId()

  const payload = {
    client_id: dados.client_id,
    origin_lead_id: dados.origin_lead_id || null,
    service_id: dados.service_id || null,
    nome: dados.nome,
    status: 'contratado',
    prioridade: dados.prioridade || 'media',
    responsavel_id: dados.responsavel_id || usuarioId,
    data_inicio: dados.data_inicio || null,
    prazo_previsto: dados.prazo_previsto || null,
    valor_contratado: dados.valor_contratado || null,
    descricao: dados.descricao || null,
    observacoes: dados.observacoes || null,
  }

  const { data, error } = await supabase.from('projects').insert(payload).select(SELECT_PROJETO_COMPLETO).single()
  if (error) throw error

  await registrarAtividadeInterno(data.id, 'Projeto criado.', usuarioId)
  if (dados.origin_lead_id) {
    await registrarAtividadeInterno(data.id, 'Origem: oportunidade convertida do Radar de Prospecção.', usuarioId)
  }

  return data
}

export async function atualizarProjeto(id, patch, descricaoAtividade) {
  requireSupabase()
  const { data, error } = await supabase.from('projects').update(patch).eq('id', id).select(SELECT_PROJETO_COMPLETO).single()
  if (error) throw error

  if (descricaoAtividade) {
    const usuarioId = await obterUsuarioAtualId()
    await registrarAtividadeInterno(id, descricaoAtividade, usuarioId)
  }

  return data
}

/**
 * Move o projeto de etapa (Kanban/select) — item 21/22/23 do planejamento.
 * Toda mudança gera atividade com status anterior/novo. Pausado/cancelado
 * aceitam motivo opcional/obrigatório (a UI decide); finalizado grava
 * data_finalizacao automaticamente.
 */
export async function moverEtapaProjeto(projeto, novoStatus, { motivo } = {}) {
  requireSupabase()
  const anterior = STATUS_PROJETO_LABEL[projeto.status] || projeto.status
  const novo = STATUS_PROJETO_LABEL[novoStatus] || novoStatus

  const patch = { status: novoStatus }
  let descricaoAtividade = `Projeto movido de ${anterior} para ${novo}.`

  if (novoStatus === 'pausado') {
    patch.motivo_pausa = motivo || null
    descricaoAtividade = motivo ? `Projeto pausado. Motivo: ${motivo}` : 'Projeto pausado.'
  } else if (novoStatus === 'cancelado') {
    patch.motivo_cancelamento = motivo || null
    descricaoAtividade = motivo ? `Projeto cancelado. Motivo: ${motivo}` : 'Projeto cancelado.'
  } else if (novoStatus === 'finalizado') {
    patch.data_finalizacao = new Date().toISOString().slice(0, 10)
    descricaoAtividade = 'Projeto finalizado.'
  }

  return atualizarProjeto(projeto.id, patch, descricaoAtividade)
}

// ----------------------------------------------------------------------------
// Tarefas / subtarefas (itens 24-27)
// ----------------------------------------------------------------------------

export async function listarTarefasProjeto(projectId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('project_tasks')
    .select('*, responsavel:profiles!project_tasks_responsavel_id_fkey ( id, nome, avatar_url )')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function criarTarefa(projectId, dados) {
  requireSupabase()
  const payload = {
    project_id: projectId,
    titulo: dados.titulo,
    descricao: dados.descricao || null,
    status: dados.status || 'a_fazer',
    prioridade: dados.prioridade || 'media',
    responsavel_id: dados.responsavel_id || null,
    prazo: dados.prazo || null,
    parent_task_id: dados.parent_task_id || null,
  }
  const { data, error } = await supabase
    .from('project_tasks')
    .insert(payload)
    .select('*, responsavel:profiles!project_tasks_responsavel_id_fkey ( id, nome, avatar_url )')
    .single()
  if (error) throw error

  await registrarAtividade(projectId, dados.parent_task_id ? `Subtarefa "${dados.titulo}" criada.` : `Tarefa "${dados.titulo}" criada.`)
  return data
}

export async function atualizarTarefa(tarefa, patch) {
  requireSupabase()
  const payloadFinal = { ...patch }
  if (patch.status === 'concluida' && tarefa.status !== 'concluida') {
    payloadFinal.concluida_em = new Date().toISOString()
  } else if (patch.status && patch.status !== 'concluida') {
    payloadFinal.concluida_em = null
  }

  const { data, error } = await supabase
    .from('project_tasks')
    .update(payloadFinal)
    .eq('id', tarefa.id)
    .select('*, responsavel:profiles!project_tasks_responsavel_id_fkey ( id, nome, avatar_url )')
    .single()
  if (error) throw error

  if (patch.status && patch.status !== tarefa.status) {
    const label = STATUS_TAREFA_LABEL[patch.status] || patch.status
    await registrarAtividade(tarefa.project_id, `Tarefa "${tarefa.titulo}" marcada como ${label.toLowerCase()}.`)
  }
  return data
}

export async function excluirTarefa(tarefa) {
  requireSupabase()
  const { error } = await supabase.from('project_tasks').delete().eq('id', tarefa.id)
  if (error) throw error
  await registrarAtividade(tarefa.project_id, `Tarefa "${tarefa.titulo}" removida.`)
}

/** Progresso de tarefas (item 45) — conta tarefas + subtarefas; distinto da timeline de etapas. Bloqueada conta no total, mas nunca como concluída. */
export function calcularProgressoTarefas(tarefas) {
  const total = tarefas.length
  const concluidas = tarefas.filter((t) => t.status === 'concluida').length
  const percentual = total === 0 ? 0 : Math.round((concluidas / total) * 100)
  return { total, concluidas, percentual }
}

// ----------------------------------------------------------------------------
// Briefing (itens 28-29) — jsonb genérico, sem engine dinâmica por serviço
// ----------------------------------------------------------------------------

export async function atualizarBriefing(projectId, briefing) {
  requireSupabase()
  const { data, error } = await supabase
    .from('projects')
    .update({ briefing, briefing_atualizado_em: new Date().toISOString() })
    .eq('id', projectId)
    .select(SELECT_PROJETO_COMPLETO)
    .single()
  if (error) throw error
  await registrarAtividade(projectId, 'Briefing atualizado.')
  return data
}

// ----------------------------------------------------------------------------
// Arquivos (itens 30-31) — metadados + URL; upload binário real fica para
// quando o Supabase Storage do projeto for avaliado (fora desta fase).
// ----------------------------------------------------------------------------

export const TIPOS_ARQUIVO = [
  { valor: 'imagem', label: 'Imagem' },
  { valor: 'pdf', label: 'PDF' },
  { valor: 'documento', label: 'Documento' },
  { valor: 'logo', label: 'Logo' },
  { valor: 'briefing', label: 'Briefing' },
  { valor: 'referencia', label: 'Referência' },
  { valor: 'outro', label: 'Outro' },
]

export async function listarArquivosProjeto(projectId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('project_files')
    .select('*, enviado_por_perfil:profiles!project_files_enviado_por_fkey ( id, nome )')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function adicionarArquivo(projectId, dados) {
  requireSupabase()
  const usuarioId = await obterUsuarioAtualId()
  const payload = {
    project_id: projectId,
    url: dados.url,
    nome_arquivo: dados.nome_arquivo || null,
    tipo: dados.tipo || 'outro',
    descricao: dados.descricao || null,
    enviado_por: usuarioId,
  }
  const { data, error } = await supabase.from('project_files').insert(payload).select().single()
  if (error) throw error
  await registrarAtividadeInterno(projectId, `Arquivo "${dados.nome_arquivo || dados.url}" adicionado.`, usuarioId)
  return data
}

export async function excluirArquivo(arquivo) {
  requireSupabase()
  const { error } = await supabase.from('project_files').delete().eq('id', arquivo.id)
  if (error) throw error
  await registrarAtividade(arquivo.project_id, `Arquivo "${arquivo.nome_arquivo || arquivo.url}" removido.`)
}

// ----------------------------------------------------------------------------
// Links do projeto (item 32)
// ----------------------------------------------------------------------------

export async function listarLinksProjeto(projectId) {
  requireSupabase()
  const { data, error } = await supabase.from('project_links').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function adicionarLink(projectId, dados) {
  requireSupabase()
  const usuarioId = await obterUsuarioAtualId()
  const payload = {
    project_id: projectId,
    nome: dados.nome,
    tipo: dados.tipo || 'outro',
    url: dados.url,
    observacao: dados.observacao || null,
    criado_por: usuarioId,
  }
  const { data, error } = await supabase.from('project_links').insert(payload).select().single()
  if (error) throw error
  await registrarAtividadeInterno(projectId, `Link "${dados.nome}" adicionado.`, usuarioId)
  return data
}

export async function excluirLink(link) {
  requireSupabase()
  const { error } = await supabase.from('project_links').delete().eq('id', link.id)
  if (error) throw error
  await registrarAtividade(link.project_id, `Link "${link.nome}" removido.`)
}

// ----------------------------------------------------------------------------
// Infraestrutura (item 33) — metadados não sensíveis, 1:1 com o projeto
// ----------------------------------------------------------------------------

export async function atualizarInfraestrutura(projectId, infra) {
  requireSupabase()
  const patch = {
    infra_dominio: infra.infra_dominio || null,
    infra_hospedagem: infra.infra_hospedagem || null,
    infra_repositorio: infra.infra_repositorio || null,
    infra_homologacao_url: infra.infra_homologacao_url || null,
    infra_banco: infra.infra_banco || null,
    infra_observacoes: infra.infra_observacoes || null,
  }
  const { data, error } = await supabase.from('projects').update(patch).eq('id', projectId).select(SELECT_PROJETO_COMPLETO).single()
  if (error) throw error
  await registrarAtividade(projectId, 'Infraestrutura do projeto atualizada.')
  return data
}

// ----------------------------------------------------------------------------
// Alterações solicitadas (item 34)
// ----------------------------------------------------------------------------

export async function listarAlteracoesProjeto(projectId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('project_change_requests')
    .select('*')
    .eq('project_id', projectId)
    .order('solicitada_em', { ascending: false })
  if (error) throw error
  return data || []
}

export async function criarAlteracao(projectId, dados) {
  requireSupabase()
  const usuarioId = await obterUsuarioAtualId()
  const payload = {
    project_id: projectId,
    descricao: dados.descricao,
    prioridade: dados.prioridade || 'media',
    observacoes: dados.observacoes || null,
    criado_por: usuarioId,
  }
  const { data, error } = await supabase.from('project_change_requests').insert(payload).select().single()
  if (error) throw error
  await registrarAtividadeInterno(projectId, 'Alteração solicitada registrada.', usuarioId)
  return data
}

export async function atualizarStatusAlteracao(alteracao, novoStatus) {
  requireSupabase()
  const patch = { status: novoStatus, updated_at: new Date().toISOString() }
  if (novoStatus === 'concluida') patch.concluida_em = new Date().toISOString()
  const { data, error } = await supabase.from('project_change_requests').update(patch).eq('id', alteracao.id).select().single()
  if (error) throw error
  await registrarAtividade(alteracao.project_id, `Alteração "${alteracao.descricao}" marcada como ${(STATUS_ALTERACAO_LABEL[novoStatus] || novoStatus).toLowerCase()}.`)
  return data
}

// ----------------------------------------------------------------------------
// Deploys (item 35) — registro manual, sem integração automática
// ----------------------------------------------------------------------------

export async function listarDeploysProjeto(projectId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('project_deploys')
    .select('*, responsavel:profiles!project_deploys_responsavel_id_fkey ( id, nome )')
    .eq('project_id', projectId)
    .order('data_deploy', { ascending: false })
  if (error) throw error
  return data || []
}

export async function registrarDeploy(projectId, dados) {
  requireSupabase()
  const usuarioId = await obterUsuarioAtualId()
  const payload = {
    project_id: projectId,
    ambiente: dados.ambiente || 'homologacao',
    versao_descricao: dados.versao_descricao || null,
    url: dados.url || null,
    data_deploy: dados.data_deploy || new Date().toISOString().slice(0, 10),
    responsavel_id: dados.responsavel_id || usuarioId,
    status: dados.status || 'sucesso',
    observacao: dados.observacao || null,
  }
  const { data, error } = await supabase
    .from('project_deploys')
    .insert(payload)
    .select('*, responsavel:profiles!project_deploys_responsavel_id_fkey ( id, nome )')
    .single()
  if (error) throw error
  await registrarAtividadeInterno(projectId, `Deploy registrado (${AMBIENTES_DEPLOY.find((a) => a.valor === payload.ambiente)?.label || payload.ambiente}).`, usuarioId)
  return data
}

// ----------------------------------------------------------------------------
// Prazos (item 38) — calculado a partir de datas reais, sem depender de
// cálculos frágeis de timezone (compara só a parte de data, meia-noite local).
// ----------------------------------------------------------------------------

export function calcularSituacaoPrazo(prazoPrevisto, statusAtual) {
  if (!prazoPrevisto) return { situacao: 'sem_prazo', diasRestantes: null }
  if (statusAtual === 'finalizado' || statusAtual === 'cancelado') return { situacao: 'encerrado', diasRestantes: null }

  const hoje = new Date()
  const hojeSoData = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const [ano, mes, dia] = prazoPrevisto.split('-').map(Number)
  const prazoData = new Date(ano, mes - 1, dia)

  const diffMs = prazoData.getTime() - hojeSoData.getTime()
  const diasRestantes = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diasRestantes < 0) return { situacao: 'atrasado', diasRestantes }
  if (diasRestantes <= 3) return { situacao: 'proximo', diasRestantes }
  return { situacao: 'normal', diasRestantes }
}
