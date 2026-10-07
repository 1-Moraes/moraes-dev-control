// ClientsService — camada de dados de Clientes (Fase 2D do planejamento).
//
// Mesma fronteira deliberada do LeadsService (ver topo de
// src/lib/crm/LeadsService.js): este arquivo é o ÚNICO lugar que fala com
// a tabela `clients` no Supabase. UI (Clientes.jsx, DrawerCliente,
// ModalConverterCliente, DrawerLead) chama só as funções daqui.
//
// A lógica de normalização de telefone/domínio se parece com a do
// LeadsService — duplicada aqui de propósito (pequena, só para a checagem
// de duplicidade de cliente) em vez de importada, pelo mesmo motivo do
// LeadsService em relação ao Deduplicator do Radar: evita acoplar este
// serviço aos internos do módulo do CRM. A única coisa importada de lá é
// `registrarAtividade`, a função pública que já é o único ponto de
// entrada pra escrever em lead_activities — converter um lead em cliente
// precisa registrar isso no histórico do próprio lead (item 15).

import { supabase } from '../supabaseClient'
import { registrarAtividade as registrarAtividadeNoLead } from '../crm/LeadsService'

export const STATUS_CLIENTE = [
  { valor: 'ativo', label: 'Ativo' },
  { valor: 'inativo', label: 'Inativo' },
  { valor: 'arquivado', label: 'Arquivado' },
]

const SELECT_CLIENTE_COMPLETO = `
  *,
  responsavel:profiles!clients_responsavel_id_fkey ( id, nome, avatar_url ),
  lead_origem:leads!clients_lead_id_fkey ( id, nome_empresa, status )
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

function requireSupabase() {
  if (!supabase) throw new Error('Supabase não configurado nesta sessão.')
}

async function obterUsuarioAtualId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || null
}

async function registrarAuditoria(acao, clienteId, metadata) {
  const usuarioId = await obterUsuarioAtualId()
  await supabase.from('audit_logs').insert({
    usuario_id: usuarioId,
    acao,
    entidade_tipo: 'cliente',
    entidade_id: clienteId,
    metadata: metadata || null,
  })
}

export async function listarClientes() {
  requireSupabase()
  const { data, error } = await supabase.from('clients').select(SELECT_CLIENTE_COMPLETO).order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function buscarCliente(id) {
  requireSupabase()
  const { data, error } = await supabase.from('clients').select(SELECT_CLIENTE_COMPLETO).eq('id', id).single()
  if (error) throw error
  return data
}

export async function listarMembrosEquipe() {
  requireSupabase()
  const { data, error } = await supabase.from('profiles').select('id, nome, avatar_url').eq('ativo', true).order('nome')
  if (error) throw error
  return data || []
}

/**
 * Histórico do cliente — vem de audit_logs (não existe uma tabela própria
 * de atividades de cliente; audit_logs já serve bem a esse propósito,
 * item 14/15/29 do planejamento).
 */
export async function listarHistoricoCliente(clienteId) {
  requireSupabase()
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, autor:profiles!audit_logs_usuario_id_fkey ( id, nome, avatar_url )')
    .eq('entidade_tipo', 'cliente')
    .eq('entidade_id', clienteId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Cliente já existe para ESTE lead (conversão repetida) — idempotência
 * exata (item 8). Diferente de `verificarDuplicata`, que é uma checagem
 * difusa (telefone/domínio/nome) entre empresas possivelmente diferentes.
 */
export async function buscarClienteDoLead(leadId) {
  requireSupabase()
  const { data } = await supabase.from('clients').select(SELECT_CLIENTE_COMPLETO).eq('lead_id', leadId).maybeSingle()
  return data || null
}

/**
 * Deduplicação de clientes (item 7 do planejamento) — prioridades, do
 * sinal mais confiável ao mais fraco. client_id já associado ao lead é
 * tratado separadamente por `buscarClienteDoLead` (chave #1 da spec).
 * NUNCA bloqueia automaticamente: só retorna o possível registro
 * relacionado para a UI decidir.
 */
export async function verificarDuplicataCliente({ telefone, website, nome, cidade }) {
  requireSupabase()

  const tel = normalizarTelefone(telefone)
  if (tel) {
    const { data } = await supabase.from('clients').select(SELECT_CLIENTE_COMPLETO).limit(100)
    const achado = (data || []).find((c) => normalizarTelefone(c.telefone) === tel)
    if (achado) return { cliente: achado, sinal: 'telefone comercial' }
  }

  const dom = dominioProprio(website)
  if (dom) {
    const { data } = await supabase.from('clients').select(SELECT_CLIENTE_COMPLETO).limit(200)
    const achado = (data || []).find((c) => dominioProprio(c.website) === dom)
    if (achado) return { cliente: achado, sinal: 'domínio próprio' }
  }

  if (nome) {
    const { data } = await supabase.from('clients').select(SELECT_CLIENTE_COMPLETO).ilike('nome_empresa', nome.trim())
    const achadoForte = (data || []).find((c) => (c.nome_empresa || '').trim().toLowerCase() === nome.trim().toLowerCase())
    if (achadoForte) return { cliente: achadoForte, sinal: 'nome' }

    if (cidade) {
      const achadoFraco = (data || []).find((c) => (c.cidade || '').trim().toLowerCase() === cidade.trim().toLowerCase())
      if (achadoFraco) return { cliente: achadoFraco, sinal: 'nome + cidade (evidência fraca)' }
    }
  }

  return null
}

/**
 * Converte um lead GANHO em cliente (itens 5, 6, 8, 9 do planejamento).
 * `dadosRevisados` é o que a pessoa confirmou no modal de revisão —
 * mapeado semanticamente de LeadCompleto, nunca copiado cegamente.
 *
 * Idempotência: se este lead já tiver um cliente (clients.lead_id = lead.id,
 * também garantido por índice único no banco), retorna o cliente existente
 * em vez de criar outro — mesmo em cliques duplicados/paralelos.
 *
 * @returns {{ jaConvertido: true, cliente: object } |
 *            { duplicata: true, clienteExistente: object, sinal: string } |
 *            { criado: true, cliente: object }}
 */
export async function converterLeadEmCliente(lead, dadosRevisados, { forcar = false } = {}) {
  requireSupabase()

  if (lead.status !== 'ganho') {
    throw new Error('Só é possível converter um lead com status Ganho.')
  }

  const existente = await buscarClienteDoLead(lead.id)
  if (existente) {
    return { jaConvertido: true, cliente: existente }
  }

  if (!forcar) {
    const possivel = await verificarDuplicataCliente({
      telefone: dadosRevisados.telefone,
      website: dadosRevisados.website,
      nome: dadosRevisados.nome_empresa,
      cidade: dadosRevisados.cidade,
    })
    if (possivel) {
      return { duplicata: true, clienteExistente: possivel.cliente, sinal: possivel.sinal }
    }
  }

  const usuarioId = await obterUsuarioAtualId()

  const payload = {
    nome_empresa: dadosRevisados.nome_empresa || lead.nome_empresa,
    lead_id: lead.id,
    origem: 'lead',
    status: 'ativo',
    segmento: dadosRevisados.segmento ?? lead.categoria ?? null,
    telefone: dadosRevisados.telefone ?? lead.telefone ?? null,
    website: dadosRevisados.website ?? lead.website ?? null,
    endereco: dadosRevisados.endereco ?? lead.endereco ?? null,
    bairro: dadosRevisados.bairro ?? lead.bairro ?? null,
    cidade: dadosRevisados.cidade ?? lead.cidade ?? null,
    estado: dadosRevisados.estado ?? lead.estado ?? null,
    responsavel_id: usuarioId,
    observacoes: dadosRevisados.observacoes ?? lead.observacoes ?? null,
  }

  const { data, error } = await supabase.from('clients').insert(payload).select(SELECT_CLIENTE_COMPLETO).single()
  if (error) {
    // Corrida rara: duas conversões em paralelo — o índice único em
    // clients.lead_id rejeita a segunda; devolvemos o cliente que venceu
    // em vez de propagar o erro de constraint pra UI.
    if (error.code === '23505') {
      const jaCriado = await buscarClienteDoLead(lead.id)
      if (jaCriado) return { jaConvertido: true, cliente: jaCriado }
    }
    throw error
  }

  await registrarAuditoria('cliente_criado', data.id, { descricao: `Cliente criado a partir do lead "${lead.nome_empresa}".`, lead_id: lead.id })
  await registrarAtividadeNoLead(lead.id, 'lead_convertido', `Lead convertido em cliente (${data.nome_empresa}).`)

  return { criado: true, cliente: data }
}

/**
 * "[Usar este cliente]" no aviso de duplicata (item 7) — o lead encontrou
 * um cliente já existente para a mesma empresa (telefone/domínio/nome).
 * NÃO altera clients.lead_id do cliente existente: essa coluna registra
 * apenas o lead que originou o cliente (é o que garante a idempotência do
 * item 8, via índice único) e um cliente só "nasce" de um lead. Em vez
 * disso, registra a relação como atividade/auditoria para rastreabilidade
 * — o cliente continua único, e este lead fica referenciado ao mesmo
 * cliente sem duplicar o cadastro.
 */
export async function vincularLeadAClienteExistente(lead, clienteExistente) {
  requireSupabase()
  await registrarAuditoria('lead_vinculado', clienteExistente.id, {
    descricao: `Lead "${lead.nome_empresa}" associado a este cliente (sem criar novo registro).`,
    lead_id: lead.id,
  })
  await registrarAtividadeNoLead(lead.id, 'lead_convertido', `Lead associado ao cliente existente (${clienteExistente.nome_empresa}), sem criar um novo cliente.`)
  return clienteExistente
}

/**
 * Cadastro manual de cliente (item 13) — não vem de um lead.
 */
export async function criarClienteManual(dados) {
  requireSupabase()
  const usuarioId = await obterUsuarioAtualId()

  const payload = {
    nome_empresa: dados.nome_empresa,
    origem: 'manual',
    status: 'ativo',
    segmento: dados.segmento || null,
    telefone: dados.telefone || null,
    email: dados.email || null,
    website: dados.website || null,
    cidade: dados.cidade || null,
    estado: dados.estado || null,
    observacoes: dados.observacoes || null,
    responsavel_id: usuarioId,
  }

  const { data, error } = await supabase.from('clients').insert(payload).select(SELECT_CLIENTE_COMPLETO).single()
  if (error) throw error

  await registrarAuditoria('cliente_criado', data.id, { descricao: `Cliente "${data.nome_empresa}" cadastrado manualmente.` })

  return data
}

export async function atualizarCliente(id, patch, descricaoAuditoria) {
  requireSupabase()
  const { data, error } = await supabase.from('clients').update(patch).eq('id', id).select(SELECT_CLIENTE_COMPLETO).single()
  if (error) throw error

  if (descricaoAuditoria) {
    await registrarAuditoria('cliente_atualizado', id, { descricao: descricaoAuditoria })
  }

  return data
}
