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
/**
 * Transferência de inteligência Radar → CRM (Fase 3A, item "transferência
 * para CRM"). `leadCandidate.analise`, quando presente, é o objeto JÁ
 * CALCULADO pelo Prospeccao.jsx (shape de calcularOpportunityScore(), ver
 * src/lib/radar/OpportunityScore.js) — este arquivo continua, de propósito,
 * NUNCA importando nada de src/lib/radar/ (mesma fronteira documentada no
 * topo do arquivo): ele só recebe o resultado já pronto como dado plano e
 * persiste, nunca recalcula nem reclassifica.
 *
 * @typedef {Object} AnaliseRadar
 * @property {number} score
 * @property {string} scoreVersion
 * @property {Array} criterios
 * @property {{categoria:string, detalhe:string|null, websiteSourceType:string, evidencias:Array, confirmacao:string}} presenca
 */
function payloadPresencaDigital(leadCandidate, usuarioId) {
  const analise = leadCandidate.analise
  if (!analise?.presenca) {
    // Sem análise calculada (ex.: candidato enviado por um fluxo que ainda
    // não passou pelo WebsiteAnalyzer) — mantém a regra original da Fase 2C:
    // nunca inferir "não tem site" a partir de campo vazio.
    return { website_source_type: leadCandidate.website ? 'unknown' : 'not_returned' }
  }
  const { presenca } = analise
  const confirmou = presenca.confirmacao && presenca.confirmacao !== 'nao_confirmado'
  return {
    website_source_type: presenca.websiteSourceType,
    website_source_detalhe: presenca.detalhe || null,
    website_confirmacao: presenca.confirmacao || 'nao_confirmado',
    website_confirmado_em: confirmou ? new Date().toISOString() : null,
    website_confirmado_por: confirmou ? usuarioId : null,
    website_url_manual: leadCandidate.siteUrlManual || null,
    instagram_url: leadCandidate.instagramUrlManual || null,
    facebook_url: leadCandidate.facebookUrlManual || null,
  }
}

/**
 * @param {string} leadId
 * @param {Object} analise - shape de calcularOpportunityScore() (score/scoreVersion/criterios/presenca)
 * @param {Object} [analiseIA] - Fase 3B — quando presente, grava a interpretação de IA NA MESMA linha
 *   (nunca em uma tabela separada, ver migration 0007): { dados (schemaAnaliseComercial.validarAnaliseComercial().dados), provider, model, promptVersao }
 * @param {string|null} [usuarioId] - autor desta rodada (item 23 do planejamento); resolvido pelo chamador, nunca inferido daqui
 */
async function persistirAnaliseInterno(leadId, analise, analiseIA = null, usuarioId = null) {
  if (!analise) return
  const payload = {
    lead_id: leadId,
    sinais: { criterios: analise.criterios, presenca: analise.presenca, scoreVersion: analise.scoreVersion, origem: 'radar' },
    score_deterministico: analise.score,
    // Fase 3B, critério de aceite explícito: a IA NUNCA altera o
    // Opportunity Score — score_final permanece sempre igual ao
    // determinístico, com ou sem interpretação de IA nesta linha.
    score_final: analise.score,
    usuario_id: usuarioId,
  }
  if (analiseIA?.dados) {
    payload.interpretacao_ia = analiseIA.dados.resumo_comercial || null
    payload.interpretacao_estruturada = analiseIA.dados
    payload.ia_provider = analiseIA.provider || null
    payload.ia_model = analiseIA.model || null
    payload.ia_prompt_versao = analiseIA.promptVersao || null
  }
  const { error } = await supabase.from('lead_analysis').insert(payload)
  // Falha ao persistir a análise nunca deve impedir a criação do lead em si
  // — é um complemento, não um pré-requisito (mesma regra de resiliência já
  // aplicada na checagem "já no CRM" do Dashboard/Prospecção).
  if (error) console.error('[LeadsService] falha ao persistir lead_analysis', error)
}

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
    ...payloadPresencaDigital(leadCandidate, usuarioId),
    prioridade: 'media',
  }

  const { data, error } = await supabase.from('leads').insert(payload).select(SELECT_LEAD_COMPLETO).single()
  if (error) throw error

  await registrarAtividadeInterno(data.id, 'lead_criado', 'Lead criado a partir do Radar de Prospecção.', usuarioId)
  // leadCandidate.analise aqui é só o Opportunity Score determinístico do
  // Radar — a interpretação de IA (Fase 3B) é sempre uma ação explícita e
  // posterior do usuário ([Analisar com IA]), nunca automática na criação
  // do lead, por isso analiseIA é null neste ponto.
  await persistirAnaliseInterno(data.id, leadCandidate.analise, null, usuarioId)

  return { duplicata: false, lead: data }
}

/**
 * Confirmação/correção manual de presença digital (Fase 3A) — chamada a
 * partir do CRM (lead já persistido). Tem precedência absoluta sobre
 * qualquer reclassificação automática futura: a UI só dispara uma nova
 * classificação automática quando `website_confirmacao` já voltou para
 * 'nao_confirmado' (reversão explícita, nunca implícita).
 *
 * @param {string} leadId
 * @param {{confirmacao:'nao_confirmado'|'confirmado_tem'|'confirmado_nao_tem', siteUrlManual?:string, instagramUrl?:string, facebookUrl?:string, websiteSourceType?:string, websiteSourceDetalhe?:string}} patch
 */
export async function registrarPresencaManual(leadId, patch) {
  requireSupabase()
  const usuarioId = await obterUsuarioAtualId()
  const confirmou = patch.confirmacao !== 'nao_confirmado'

  const dbPatch = {
    website_confirmacao: patch.confirmacao,
    website_confirmado_em: confirmou ? new Date().toISOString() : null,
    website_confirmado_por: confirmou ? usuarioId : null,
    website_url_manual: patch.siteUrlManual ?? null,
    instagram_url: patch.instagramUrl ?? null,
    facebook_url: patch.facebookUrl ?? null,
  }
  if (patch.websiteSourceType) dbPatch.website_source_type = patch.websiteSourceType
  if ('websiteSourceDetalhe' in patch) dbPatch.website_source_detalhe = patch.websiteSourceDetalhe ?? null

  const { error } = await supabase.from('leads').update(dbPatch).eq('id', leadId)
  if (error) throw error

  const detalheAtividade =
    patch.confirmacao === 'confirmado_nao_tem'
      ? 'Confirmado manualmente que o negócio não possui site.'
      : patch.confirmacao === 'confirmado_tem'
        ? 'Confirmada/corrigida manualmente a presença digital do negócio.'
        : 'Confirmação manual de presença digital revertida para "não confirmado".'
  await registrarAtividadeInterno(leadId, 'presenca_digital_atualizada', detalheAtividade, usuarioId)
}

/**
 * Persiste uma nova rodada de Opportunity Score (recálculo manual ou após
 * correção de presença digital) na lead_analysis — nunca sobrescreve a
 * linha anterior, cada rodada é uma linha nova (auditoria, igual ao
 * racional original da tabela desde a Fase 0).
 * @param {string} leadId
 * @param {AnaliseRadar} analise
 * @param {Object} [analiseIA] - Fase 3B, opcional: quando o recálculo do score
 *   e uma interpretação de IA já validada acontecem juntos (caso raro — o
 *   fluxo normal é analisar IA sobre um score já existente, ver
 *   salvarAnaliseIA abaixo).
 */
export async function registrarNovaAnalise(leadId, analise, analiseIA = null) {
  requireSupabase()
  const usuarioId = await obterUsuarioAtualId()
  await persistirAnaliseInterno(leadId, analise, analiseIA, usuarioId)
}

/**
 * Fase 3B, item 26 do planejamento ("[Salvar análise]" no painel de IA,
 * tanto no Radar quanto no CRM): persiste uma interpretação de IA já
 * gerada e validada no servidor (ver api/ia-radar.js +
 * schemaAnaliseComercial.js) junto com o Opportunity Score determinístico
 * vigente no momento da análise — como uma NOVA linha de lead_analysis,
 * nunca sobrescrevendo histórico anterior (mesma regra de
 * registrarNovaAnalise). A IA nunca recalcula nem altera o score: `analise`
 * é sempre o resultado de calcularOpportunityScore(), igual a qualquer
 * outra chamada de persistirAnaliseInterno.
 *
 * @param {string} leadId
 * @param {AnaliseRadar} analise - score determinístico vigente (nunca gerado/alterado pela IA)
 * @param {{dados:Object, provider:string, model:string, promptVersao:string}} resultadoIA - saída já validada por schemaAnaliseComercial.validarAnaliseComercial()
 */
export async function salvarAnaliseIA(leadId, analise, resultadoIA) {
  requireSupabase()
  if (!resultadoIA?.dados) return
  const usuarioId = await obterUsuarioAtualId()
  await persistirAnaliseInterno(leadId, analise, resultadoIA, usuarioId)
}

export async function buscarUltimaAnalise(leadId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('lead_analysis')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Fase 3B, item 32 do planejamento: "análise desatualizada" nunca pode ser
 * escondida silenciosamente quando a evidência do lead mudou depois da
 * última análise salva. Heurística deliberadamente simples e transparente
 * (documentar isso no relatório final, não é um diff de evidências campo a
 * campo): compara o instante em que a linha de lead_analysis foi criada com
 * leads.updated_at — a trigger leads_set_updated_at já atualiza essa coluna
 * em QUALQUER alteração do lead (confirmação manual de presença digital,
 * mudança de status no Kanban, etc.), então este é um sinal "pode estar
 * desatualizada" por cima (prefere avisar demais a esconder a
 * possibilidade), não uma detecção exata de que a evidência específica
 * usada pela IA mudou.
 * @param {{created_at:string}} analiseRow - linha de lead_analysis (ex.: resultado de buscarUltimaAnalise)
 * @param {{updated_at:string}} lead
 */
export function analiseEstaDesatualizada(analiseRow, lead) {
  if (!analiseRow?.created_at || !lead?.updated_at) return false
  return new Date(lead.updated_at).getTime() > new Date(analiseRow.created_at).getTime()
}

/**
 * Fase 3B, item 17 do planejamento (mensagem de abordagem sugerida):
 * persiste um rascunho gerado por IA em lead_messages (tabela já existente,
 * reaproveitada — nenhuma tabela nova criada). Nunca marca `enviado`
 * automaticamente: o envio real é sempre uma ação manual do usuário
 * ([Abrir WhatsApp]); este serviço só guarda o texto para
 * histórico/rastreabilidade de quem gerou/editou o quê.
 * @param {string} leadId
 * @param {{mensagemWhatsapp:string, canal?:string}} abordagem
 */
export async function salvarAbordagemGerada(leadId, { mensagemWhatsapp, canal = 'whatsapp' } = {}) {
  requireSupabase()
  if (!mensagemWhatsapp) return null
  const { data, error } = await supabase
    .from('lead_messages')
    .insert({ lead_id: leadId, canal, rascunho: mensagemWhatsapp, criado_por_ia: true })
    .select()
    .single()
  if (error) {
    // Mesma regra de resiliência de persistirAnaliseInterno: falha ao
    // salvar o rascunho não pode travar o fluxo de "[Abrir WhatsApp]" —
    // é um complemento de histórico, não um pré-requisito para o usuário
    // conseguir enviar a mensagem.
    console.error('[LeadsService] falha ao persistir lead_messages', error)
    return null
  }
  return data
}

/**
 * Histórico de rascunhos de abordagem (gerados por IA ou manuais) de um
 * lead, mais recentes primeiro — usado pelo painel de IA para mostrar
 * tentativas anteriores.
 * @param {string} leadId
 */
export async function buscarMensagensLead(leadId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('lead_messages')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/**
 * Marca um rascunho como aberto/utilizado quando o usuário clica
 * [Abrir WhatsApp] — continua sendo só um registro de histórico (a ação de
 * enviar a mensagem em si acontece no WhatsApp, fora deste sistema; nunca
 * há envio automático aqui).
 * @param {string} mensagemId
 */
export async function marcarMensagemComoAberta(mensagemId) {
  requireSupabase()
  const { error } = await supabase.from('lead_messages').update({ enviado: true }).eq('id', mensagemId)
  if (error) console.error('[LeadsService] falha ao marcar lead_messages como aberta', error)
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
