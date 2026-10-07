// ProjectsService — camada de dados de Projetos (Fase 2D do planejamento).
//
// Mesma fronteira do LeadsService/ClientsService: único lugar que fala com
// `projects`/`project_activities`/`services` no Supabase. Esta fase só
// cobre a CRIAÇÃO inicial do projeto — gestão operacional completa
// (Kanban, tarefas, briefing) é Fase 2E, não implementada aqui.

import { supabase } from '../supabaseClient'

export const STATUS_PROJETO = [
  { valor: 'contratado', label: 'Contratado' },
  { valor: 'briefing', label: 'Briefing' },
  { valor: 'planejamento', label: 'Planejamento' },
  { valor: 'design', label: 'Design' },
  { valor: 'desenvolvimento', label: 'Desenvolvimento' },
  { valor: 'homologacao', label: 'Homologação' },
  { valor: 'ajustes', label: 'Ajustes' },
  { valor: 'publicacao', label: 'Publicação' },
  { valor: 'finalizado', label: 'Finalizado' },
  { valor: 'pausado', label: 'Pausado' },
  { valor: 'cancelado', label: 'Cancelado' },
]

export const STATUS_PROJETO_LABEL = Object.fromEntries(STATUS_PROJETO.map((s) => [s.valor, s.label]))

export const PRIORIDADES_PROJETO = [
  { valor: 'baixa', label: 'Baixa' },
  { valor: 'media', label: 'Média' },
  { valor: 'alta', label: 'Alta' },
]

const SELECT_PROJETO_COMPLETO = `
  *,
  cliente:clients!projects_client_id_fkey ( id, nome_empresa ),
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
 * Cria o projeto inicial (itens 16-19 do planejamento). Sempre com
 * client_id preenchido; origin_lead_id só quando o cliente veio de uma
 * conversão de lead (item 19 — "quando aplicável"). Sem deduplicação
 * agressiva (item 23): dois cliques podem representar dois projetos reais
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
