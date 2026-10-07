// Normalizador — porta para JS do normalizer/normalize.py validado na
// Fase 2A/2A.1 do laboratório (moraes-radar-lab), incluindo a correção
// aplicada lá: extrair bairro/cidade/estado de "complete_address" em vez
// de descartar esse dado (ver docs/relatorio-fase-2a.md, seção 8-13).
//
// Regra de ouro, igual ao laboratório: campo ausente ou vazio na fonte ->
// null. NUNCA inferir "não tem site"/"não tem telefone" a partir de um
// campo vazio — só registrar que a fonte não retornou aquele dado.
//
// Roda do lado do servidor (dentro de api/radar-buscar.js). Entrada: um
// array de registros brutos no formato Entry do gosom/google-maps-scraper.
// Saída: array de LeadCandidate normalizados (ver tipo abaixo).

/**
 * @typedef {Object} LeadCandidate
 * @property {string} source
 * @property {string|null} sourceId
 * @property {string|null} name
 * @property {string|null} category
 * @property {string|null} address
 * @property {string|null} neighborhood
 * @property {string|null} city
 * @property {string|null} state
 * @property {string|null} phone
 * @property {string|null} website
 * @property {number|null} rating
 * @property {number|null} reviewCount
 * @property {number|null} latitude
 * @property {number|null} longitude
 * @property {string|null} email
 * @property {string[]} socials
 * @property {string} discoveredAt - ISO 8601
 * @property {string} query
 * @property {string} rawSourceRef
 */

function vazioParaNulo(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'string' && v.trim() === '') return null
  return v
}

/**
 * @param {Object} bruto - registro Entry do gosom/google-maps-scraper
 * @param {string} query
 * @param {number} indice
 * @returns {LeadCandidate}
 */
export function normalizarRegistro(bruto, query, indice) {
  const enderecoCompleto = bruto.complete_address || {}

  return {
    source: 'google_maps_scraper',
    sourceId: vazioParaNulo(bruto.place_id || bruto.cid),
    name: vazioParaNulo(bruto.title),
    category: vazioParaNulo(bruto.category),
    address: vazioParaNulo(bruto.address),
    neighborhood: vazioParaNulo(enderecoCompleto.borough),
    city: vazioParaNulo(enderecoCompleto.city),
    state: vazioParaNulo(enderecoCompleto.state),
    phone: vazioParaNulo(bruto.phone),
    website: vazioParaNulo(bruto.web_site),
    rating: bruto.review_rating || null,
    reviewCount: bruto.review_count || null,
    latitude: typeof bruto.latitude === 'number' ? bruto.latitude : null,
    // "longtitude" (sic) — typo existe no schema real do gosom/google-maps-scraper
    longitude: typeof bruto.longtitude === 'number' ? bruto.longtitude : null,
    email: (bruto.emails && bruto.emails[0]) || null,
    socials: [],
    discoveredAt: new Date().toISOString(),
    query,
    rawSourceRef: `registro_bruto_indice_${indice}`,
  }
}

/**
 * @param {Object[]} registrosBrutos
 * @param {string} query
 * @returns {LeadCandidate[]}
 */
export function normalizar(registrosBrutos, query) {
  return registrosBrutos.map((r, i) => normalizarRegistro(r, query, i))
}

/**
 * Métricas de cobertura — mesmo cálculo usado no relatório da Fase 2A/2A.1.
 * @param {LeadCandidate[]} normalizados
 */
export function calcularCobertura(normalizados) {
  const total = normalizados.length
  if (!total) {
    return { total: 0, telefone: 0, website: 0, coordenadas: 0, rating: 0, reviews: 0 }
  }
  const pct = (n) => Math.round((n / total) * 1000) / 10
  return {
    total,
    telefone: pct(normalizados.filter((r) => r.phone).length),
    website: pct(normalizados.filter((r) => r.website).length),
    coordenadas: pct(normalizados.filter((r) => r.latitude && r.longitude).length),
    rating: pct(normalizados.filter((r) => r.rating).length),
    reviews: pct(normalizados.filter((r) => r.reviewCount).length),
  }
}
