// Deduplicador — estratégia validada na Fase 2A/2A.1 do laboratório
// (moraes-radar-lab/docs/dedup-strategy.md, confirmada com dados reais em
// relatorio-fase-2a1-validacao.md, seção 3).
//
// Prioridade de sinais (do mais confiável ao mais fraco):
//   1. sourceId (place_id/cid) idêntico
//   2. telefone normalizado idêntico
//   3. domínio PRÓPRIO do negócio idêntico (NUNCA domínio de rede social
//      genérica — facebook.com/instagram.com/etc. não deve juntar negócios
//      diferentes, erro confirmado na Fase 2A.1)
//   4. nome + endereço (normalizados) idênticos
//   5. coordenadas quase idênticas — só EVIDÊNCIA COMPLEMENTAR, nunca
//      critério isolado (negócios diferentes podem compartilhar prédio,
//      confirmado na Fase 2A.1 com duas dentistas no mesmo endereço)
//
// IMPORTANTE: esta função NUNCA remove registros. Ela só anota
// `duplicateGroup` e `duplicateSignal` em cada LeadCandidate — a decisão de
// mesclar/descartar fica para uma revisão manual futura (ainda não
// implementada), exatamente como pedido: "quando houver ambiguidade,
// preservar registro e marcar possível duplicata".

const DOMINIOS_GENERICOS = new Set([
  'facebook.com',
  'www.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'wa.me',
  'linktr.ee',
  'linktree.com',
  'bio.site',
  'booksy.com',
  'trinks.com',
  'meudoutor.com',
])

function normalizarTelefone(tel) {
  if (!tel) return null
  const digitos = tel.replace(/\D/g, '')
  if (!digitos) return null
  // remove código do país (+55) se vier, mantém DDD + número
  return digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos
}

function dominioProprio(url) {
  if (!url) return null
  const m = url.match(/https?:\/\/(?:www\.)?([^/]+)/i)
  if (!m) return null
  const host = m[1].toLowerCase()
  return DOMINIOS_GENERICOS.has(host) ? null : host
}

function chaveNomeEndereco(lead) {
  const nome = (lead.name || '').trim().toLowerCase()
  const endereco = (lead.address || '').trim().toLowerCase()
  if (!nome) return null
  return `${nome}::${endereco}`
}

function coordenadasProximas(a, b, limiar = 0.00015) {
  if (!a.latitude || !a.longitude || !b.latitude || !b.longitude) return false
  return Math.abs(a.latitude - b.latitude) < limiar && Math.abs(a.longitude - b.longitude) < limiar
}

/**
 * @param {import('./Normalizer').LeadCandidate[]} leads
 * @returns {{ leads: Array, gruposDuplicados: Array }}
 */
export function deduplicar(leads) {
  const porSourceId = new Map()
  const porTelefone = new Map()
  const porDominio = new Map()
  const porNomeEndereco = new Map()

  leads.forEach((lead, i) => {
    if (lead.sourceId) {
      porSourceId.set(lead.sourceId, [...(porSourceId.get(lead.sourceId) || []), i])
    }
    const tel = normalizarTelefone(lead.phone)
    if (tel) porTelefone.set(tel, [...(porTelefone.get(tel) || []), i])

    const dom = dominioProprio(lead.website)
    if (dom) porDominio.set(dom, [...(porDominio.get(dom) || []), i])

    const chaveNE = chaveNomeEndereco(lead)
    if (chaveNE) porNomeEndereco.set(chaveNE, [...(porNomeEndereco.get(chaveNE) || []), i])
  })

  const resultado = leads.map((lead) => ({ ...lead, duplicateGroup: null, duplicateSignal: null }))
  const gruposDuplicados = []
  let proximoGrupo = 1

  function marcarGrupo(indices, sinal) {
    if (indices.length < 2) return
    const grupo = proximoGrupo++
    indices.forEach((i) => {
      // não sobrescreve um grupo já marcado por um sinal mais forte
      if (!resultado[i].duplicateGroup) {
        resultado[i].duplicateGroup = grupo
        resultado[i].duplicateSignal = sinal
      }
    })
    gruposDuplicados.push({
      grupo,
      sinal,
      indices,
      nomes: indices.map((i) => leads[i].name),
    })
  }

  for (const [, indices] of porSourceId) marcarGrupo(indices, 'sourceId')
  for (const [, indices] of porTelefone) marcarGrupo(indices, 'telefone')
  for (const [, indices] of porDominio) marcarGrupo(indices, 'dominio_proprio')
  for (const [, indices] of porNomeEndereco) marcarGrupo(indices, 'nome_endereco')

  // Coordenadas: só complementar — marca como "coincidencia_endereco" quando
  // dois leads têm coordenadas quase idênticas mas NENHUM sinal forte já os
  // ligou. Isso vira um alerta de "mesmo prédio", não uma duplicata.
  for (let a = 0; a < leads.length; a++) {
    for (let b = a + 1; b < leads.length; b++) {
      if (resultado[a].duplicateGroup || resultado[b].duplicateGroup) continue
      if (coordenadasProximas(leads[a], leads[b])) {
        marcarGrupo([a, b], 'coordenadas_proximas_sem_outro_sinal')
      }
    }
  }

  return { leads: resultado, gruposDuplicados }
}
