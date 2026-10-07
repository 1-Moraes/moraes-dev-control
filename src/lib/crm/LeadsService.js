// LeadsService — camada de dados do CRM / Leads (Fase 2C do planejamento).
//
// Fronteira deliberada, no mesmo espírito do Radar (ver nota no topo de
// Prospeccao.jsx): este arquivo é o ÚNICO lugar que fala com as tabelas
// leads/lead_notes/lead_activities/lead_sources no Supabase. Componentes de
// UI (Crm.jsx, Kanban, Tabela, Drawer, integração no Radar) chamam só as
// funções daqui — nunca `supabase.from('leads')` diretamente.
//
// NÃO importa nada de src/lib/radar/ (Normalizer/Deduplicator) — mesmo que
// a lógica de normalização de telefone/domínio se pareça com a do
// Deduplicator.js, duplicá-la aqui (minúscula, só para a checagem de
// duplicidade no momento de inserir) evita acoplar o CRM à implementação
// interna do Radar, que o planejamento pede para não tocar nesta fase.

import { supabase } from '../supabaseClient'

export const STATUS_PIPELINE = [
  { valor: 'descoberto', label: 'Descoberto' },
  { valor: 'qualificado', label: 'Qualificado' },
  { valor: 'contato_preparado', label: 'Contato preparado' },
  { valor: 'contatado', label: 'Contatado' },
  { valor: 'respondeu', label: 'Respondeu' },
  { valor: 'reuniao', label: 'Reunião' },
  { valor: 'proposta', label: 'Proposta' },
  { valor: 'negociacao', label: 'Negociação' },
  { valor: 'ganho', label: 'Ganho' },
  { valor: 'perdido', label: 'Perdido' },
]

export const STATUS_LABEL = Object.fromEntries(STATUS_PIPELINE.map((s) => [s.valor, s.label]))

export const PRIORIDADES = [
  { valor: 'baixa', label: 'Baixa' },
  { valor: 'media', label: 'Média' },
  { valor: 'alta', label: 'Alta' },
]

export const PROXIMA_ACAO_TIPOS = [
  { valor: 'whatsapp', label: 'WhatsApp' },
  { valor: 'ligacao', label: 'Ligação' },
  { valor: 'follow_up', label: 'Follow-up' },
  { valor: 'reuniao', label: 'Reunião' },
  { valor: 'proposta', label: 'Proposta' },
  { valor: 'outro', label: 'Outro' },
]

export const MOTIVOS_PERDA = [
  { valor: 'sem_interesse', label: 'Sem interesse' },
  { valor: 'preco', label: 'Preço' },
  { valor: 'ja_possui_fornecedor', label: 'Já possui fornecedor' },
  { valor: 'nao_respondeu', label: 'Não respondeu' },
  { valor: 'timing', label: 'Timing' },
  { valor: 'outro', label: 'Outro' },
]

const SELECT_LEAD_COMPLETO = `
  *,
  responsavel:profiles!leads_responsavel_id_fkey ( id, nome, avatar_url ),
  origem:lead_sources ( id, nome, tipo )
`

function normalizarTelefone(tel) {
  if (!tel) return null
  const digitos = String(tel).replace(/\D/g, '')
  if (!digitos) return null
  return digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos
}

const DOMINIOS_GENERICOS = new Set([
  'facebook.com',
  'www.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'wa.me',
  'linktr.ee',
  'linktree.com',
  'bio.site',
])

function dominioProprio(url) {
  if (!url) return null
  const m = String(url).match(/https?:\/\/(?:www\.)?([^/]+)/i)
  if (!m) return null
  const host = m[1].toLowerCase()
  return DOMINIOS_GENERICOS.has(host) ? null : host
}

async function obterUsuarioAtualId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase não configurado nesta sessão.')
}

/**
 * Lista todos os leads com responsável e origem já resolvidos, ordenados
 * por atualização mais recente primeiro.
 */
export async function listarLeads() {
  requireSupabase()
  const { data, error } = await supabase.from('leads').select(SELECT_LEAD_COMPLETO).order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function buscarLead(id) {
  requireSupabase()
  const { data, error } = await supabase.from('leads').select(SELECT_LEAD_COMPLETO).eq('id', id).single()
  if (error) throw error
  return data
}

/**
 * Deduplicação (item 15 do planejamento) — prioridades, do sinal mais
 * confiável ao mais fraco. NUNCA bloqueia automaticamente: só retorna o
 * possível registro relacionado para a UI decidir ([Abrir existente] ou
 * [Adicionar mesmo assim]). Coordenadas entram só como evidência
 * complementar textual, nunca como critério isolado de busca aqui.
 */
export async function verificarDuplicata({ origemProvider, origemSourceId, telefone, website, nome, endereco }) {
  requireSupabase()

  if (origemProvider && origemSourceId) {
    const { data } = await supabase
      .from('leads')
      .select(SELECT_LEAD_COMPLETO)
      .eq('origem_provider', origemProvider)
      .eq('origem_source_id', origemSourceId)
      .limit(1)
      .maybeSingle()
    if (data) return { lead: data, sinal: 'origem (mesma fonte e id)' }
  }

  const tel = normalizarTelefone(telefone)
  if (tel) {
    const { data } = await supabase.from('leads').select(SELECT_LEAD_COMPLETO).limit(50)
    const achado = (data || []).find((l) => normalizarTelefone(l.telefone) === tel)
    if (achado) return { lead: achado, sinal: 'telefone' }
  }

  const dom = dominioProprio(website)
  if (dom) {
    const { data } = await supabase.from('leads').select(SELECT_LEAD_COMPLETO).limit(200)
    const achado = (data || []).find((l) => dominioProprio(l.website) === dom)
    if (achado) return { lead: achado, sinal: 'domínio próprio' }
  }

  if (nome) {
    const chave = `${nome.trim().toLowerCase()}::${(endereco || '').trim().toLowerCase()}`
    const { data } = await supabase.from('leads').select(SELECT_LEAD_COMPLETO).ilike('nome_empresa', nome.trim())
    const achado = (data || []).find((l) => `${(l.nome_empresa || '').trim().toLowerCase()}::${(l.endereco || '').trim().toLowerCase()}` === chave)
    if (achado) return { lead: achado, sinal: 'nome + endereço' }
  }

  return null
}

/**
 * Versão em LOTE de verificarDuplicata — Fase 2F, item "Já no CRM" do
 * Radar. MESMA lógica/prioridade de sinais (origem > telefone > domínio
 * próprio > nome+endereço), só reestruturada para checar MUITOS candidatos
 * de uma vez com UMA única leitura da tabela `leads`, em vez de repetir
 * verificarDuplicata() (3 idas ao Supabase cada) para cada card do Radar —
 * o próprio planejamento pede "não criar uma segunda lógica contraditória",
 * então aqui só muda a forma de aplicar as mesmas regras, nunca o critério.
 *
 * @param {Array<{id:string, source?:string, sourceId?:string, phone?:string, website?:string, name?:string, address?:string}>} leadCandidates
 * @returns {Promise<Map<string, {leadId: string, sinal: string}>>} chave = candidate.id (id do Radar, não da tabela leads)
 */
export async function verificarDuplicatasEmLote(leadCandidates) {
  requireSupabase()
  const resultado = new Map()
  if (!leadCandidates?.length) return resultado

  const { data, error } = await supabase
    .from('leads')
    .select('id, nome_empresa, endereco, telefone, website, origem_provider, origem_source_id')
  if (error) throw error
  const leadsReais = data || []

  for (const candidato of leadCandidates) {
    let achado = null

    if (candidato.source && candidato.sourceId) {
      const l = leadsReais.find((l) => l.origem_provider === candidato.source && l.origem_source_id === candidato.sourceId)
      if (l) achado = { leadId: l.id, sinal: 'origem (mesma fonte e id)' }
    }

    if (!achado) {
      const tel = normalizarTelefone(candidato.phone)
      if (tel) {
        const l = leadsReais.find((l) => normalizarTelefone(l.telefone) === tel)
        if (l) achado = { leadId: l.id, sinal: 'telefone' }
      }
    }

    if (!achado) {
      const dom = dominioProprio(candidato.website)
      if (dom) {
        const l = leadsReais.find((l) => dominioProprio(l.website) === dom)
        if (l) achado = { leadId: l.id, sinal: 'domínio próprio' }
      }
    }

    if (!achado && candidato.name) {
      const chave = `${candidato.name.trim().toLowerCase()}::${(candidato.address || '').trim().toLowerCase()}`
      const l = leadsReais.find((l) => `${(l.nome_empresa || '').trim().toLowerCase()}::${(l.endereco || '').trim().toLowerCase()}` === chave)
      if (l) achado = { leadId: l.id, sinal: 'nome + endereço' }
    }

    if (achado) resultado.set(candidato.id, achado)
  }

  return resultado
}

async function obterOuCriarOrigemRadar() {
  const { data } = await supabase.from('lead_sources').select('id').eq('nome', 'Radar de Prospecção').maybeSingle()
  return data?.id || null
}

async function registrarAtividadeInterno(leadId, tipo, detalhe, autorId) {
  const { error } = await supabase.from('lead_activities').insert({ lead_id: leadId, tipo, detalhe, autor_id: autorId })
  if (error) throw error
}

export async function registrarAtividade(leadId, tipo, detalhe) {
  requireSupabase()
  const autorId = await obterUsuarioAtualId()
  await registrarAtividadeInterno(leadId, tipo, detalhe, autorId)
}

/**
 * Cria um lead no CRM a partir de um LeadCandidate do Radar (ver
 * Normalizer.js — este serviço só LÊ o formato, nunca importa o módulo).
 * Sempre roda a checagem de duplicidade antes, a menos que `forcar` seja
 * true (fluxo de "[Adicionar mesmo assim]" depois do aviso ao usuário).
 *
 * @returns {{ duplicata: true, leadExistente: object, sinal: string } | { duplicata: false, lead: object }}
 */
export async function criarLeadDoRadar(leadCandidate, { forcar = false } = {}) {
  requireSupabase()

  if (!forcar) {
    const possivel = await verificarDuplicata({
      origemProvider: leadCandidate.source,
      origemSourceId: leadCandidate.sourceId,
      telefone: leadCandidate.phone,
      website: leadCandidate.website,
      nome: leadCandidate.name,
      endereco: leadCandidate.address,
    })
    if (possivel) {
      return { duplicata: true, leadExistente: possivel.lead, sinal: possivel.sinal }
    }
  }

  const usuarioId = await obterUsuarioAtualId()
  const origemId = await obterOuCriarOrigemRadar()

  const payload = {
    nome_empresa: leadCandidate.name || 'Empresa sem nome',
    categoria: leadCandidate.category || null,
    website: leadCandidate.website || null,
    status: 'descoberto',
    lead_source_id: origemId,
    responsavel_id: usuarioId,
    origem_provider: leadCandidate.source || null,
    origem_source_id: leadCandidate.sourceId || null,
    descoberto_em: leadCandidate.discoveredAt || new Date().toISOString(),
    endereco: leadCandidate.address || null,
    bairro: leadCandidate.neighborhood || null,
    cidade: leadCandidate.city || null,
    estado: leadCandidate.state || null,
    latitude: leadCandidate.latitude ?? null,
    longitude: leadCandidate.longitude ?? null,
    telefone: leadCandidate.phone || null,
    email: leadCandidate.email || null,
    rating: leadCandidate.rating ?? null,
    quantidade_avaliacoes: leadCandidate.reviewCount ?? null,
    // Regra explícita do item 5 do planejamento: nunca inferir
    // "empresa não tem site" a partir de um campo vazio. Se a fonte não
    // retornou website, o estado é "not_returned"; se retornou mas ainda
    // não foi analisado (WebsiteAnalyzer não existe nesta fase), é
    // "unknown" — nunca um dos dois é decidido automaticamente aqui.
    website_source_type: leadCandidate.website ? 'unknown' : 'not_returned',
    prioridade: 'media',
  }

  const { data, error } = await supabase.from('leads').insert(payload).select(SELECT_LEAD_COMPLETO).single()
  if (error) throw error

  await registrarAtividadeInterno(data.id, 'lead_criado', 'Lead criado a partir do Radar de Prospecção.', usuarioId)

  return { duplicata: false, lead: data }
}

export async function atualizarStatus(leadId, novoStatus, { motivoPerda } = {}) {
  requireSupabase()
  const atual = await buscarLead(leadId)
  const patch = { status: novoStatus }
  if (novoStatus === 'perdido') patch.motivo_perda = motivoPerda || null
  if (novoStatus !== 'perdido' && atual.status === 'perdido') patch.motivo_perda = null

  const { data, error } = await supabase.from('leads').update(patch).eq('id', leadId).select(SELECT_LEAD_COMPLETO).single()
  if (error) throw error

  const autorId = await obterUsuarioAtualId()
  const de = STATUS_LABEL[atual.status] || atual.status
  const para = STATUS_LABEL[novoStatus] || novoStatus
  let detalhe = `Status alterado: ${de} → ${para}.`
  if (novoStatus === 'perdido') {
    const motivoLabel = MOTIVOS_PERDA.find((m) => m.valor === motivoPerda)?.label
    detalhe = `Lead marcado como perdido${motivoLabel ? ` (motivo: ${motivoLabel})` : ''}.`
  } else if (novoStatus === 'ganho') {
    detalhe = 'Lead marcado como ganho.'
  }
  await registrarAtividadeInterno(leadId, 'status_alterado', detalhe, autorId)

  return data
}

/**
 * Atualização genérica de campos comerciais (prioridade, responsável,
 * serviço de interesse, próxima ação, observações). `descricaoAtividade`
 * opcional registra uma atividade amigável para o que mudou.
 */
export async function atualizarCampos(leadId, patch, descricaoAtividade) {
  requireSupabase()
  const { data, error } = await supabase.from('leads').update(patch).eq('id', leadId).select(SELECT_LEAD_COMPLETO).single()
  if (error) throw error

  if (descricaoAtividade) {
    const autorId = await obterUsuarioAtualId()
    await registrarAtividadeInterno(leadId, 'campo_alterado', descricaoAtividade, autorId)
  }

  return data
}

export async function adicionarNota(leadId, texto) {
  requireSupabase()
  const autorId = await obterUsuarioAtualId()
  const { data, error } = await supabase
    .from('lead_notes')
    .insert({ lead_id: leadId, texto, autor_id: autorId })
    .select('*, autor:profiles ( id, nome, avatar_url )')
    .single()
  if (error) throw error

  await registrarAtividadeInterno(leadId, 'nota_adicionada', 'Nota adicionada.', autorId)

  return data
}

export async function listarNotas(leadId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('lead_notes')
    .select('*, autor:profiles ( id, nome, avatar_url )')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function listarAtividades(leadId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('lead_activities')
    .select('*, autor:profiles ( id, nome, avatar_url )')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function listarMembrosEquipe() {
  requireSupabase()
  const { data, error } = await supabase.from('profiles').select('id, nome, avatar_url').eq('ativo', true).order('nome')
  if (error) throw error
  return data || []
}
