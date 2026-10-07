// OpenStreetMapProvider — DiscoveryProvider REAL e dinâmico (ajuste da
// Fase 3A: "Radar com busca dinâmica por localidade").
//
// POR QUE ESTE PROVIDER EXISTE:
// o provider anterior (hoje FixtureDiscoveryProvider.js) só cobria 3
// combinações fixas de segmento+localização pré-coletadas — "Cotia
// funcionava" só porque era a cidade das fixtures de barbearia/dentista.
// Qualquer outra cidade nunca teve chance de retornar algo. Este provider
// resolve isso consultando, AO VIVO, duas APIs públicas, gratuitas e sem
// necessidade de chave/billing:
//   1. Nominatim (nominatim.openstreetmap.org) — geocodifica a localização
//      digitada (cidade, bairro+cidade, região) num ponto lat/lon real.
//   2. Overpass API (overpass-api.de) — busca negócios reais do OpenStreetMap
//      ao redor desse ponto, filtrando por tags associadas ao segmento
//      digitado (ver segmentosOsm.js — um DICIONÁRIO de categorias, nunca
//      um `if (cidade === X)`).
//
// NENHUMA cidade é hardcoded neste arquivo. A MESMA lógica roda para
// qualquer localização que o usuário digitar — a "cobertura" passa a
// depender só de o OpenStreetMap ter dados mapeados ali (normalmente tem,
// para qualquer cidade brasileira de porte razoável), nunca de um catálogo
// fixo neste código.
//
// LIMITAÇÕES HONESTAS (documentadas, nunca escondidas):
//   - O OpenStreetMap raramente tem avaliação/quantidade de avaliações
//     (isso é um dado de plataformas comerciais como Google Maps, não do
//     OSM) — o Componente B do Opportunity Score (Qualificação/Demanda)
//     tende a ficar em 0 para a maioria dos resultados deste provider.
//     Isso é uma limitação de COBERTURA DE DADO, não um bug: nunca
//     inventamos rating/reviewCount.
//   - Nominatim/Overpass são serviços públicos comunitários com política de
//     uso (rate limit ~1 req/s, exige User-Agent identificável) — adequados
//     para o volume de uso de um projeto pessoal, mas não para tráfego alto
//     sem self-hosting. Documentado no relatório final, nunca escondido.
//   - Não há chave de API, não há billing, não há custo — ver seção
//     "custo" do relatório final.

import { tagsParaSegmento } from './segmentosOsm.js'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
// Identificação exigida pela política de uso do Nominatim
// (https://operations.osmfoundation.org/policies/nominatim/) — nunca um
// segredo, só um identificador do projeto, server-side.
const USER_AGENT = 'moraes-dev-control-radar/1.0 (uso pessoal, projeto Moraes.Dev; contato: joaopedromo8712@gmail.com)'

const RAIO_MINIMO_M = 3000
const RAIO_MAXIMO_M = 20000
const RAIO_PADRAO_M = 12000
const TIMEOUT_NOMINATIM_MS = 8000
const TIMEOUT_OVERPASS_MS = 18000

function semAcento(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

async function fetchComTimeout(url, opcoes, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opcoes, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Distância Haversine em metros entre dois pontos — usada só para estimar
 * um raio de busca a partir do bounding box que o próprio Nominatim
 * devolve (localidades maiores → raio maior; um bairro específico →
 * raio menor), nunca um valor fixo por cidade.
 */
function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * @param {string[]} boundingbox - [south, north, west, east] como vem do Nominatim
 * @returns {number} raio em metros, limitado a [RAIO_MINIMO_M, RAIO_MAXIMO_M]
 */
export function raioDeBoundingBox(boundingbox) {
  if (!Array.isArray(boundingbox) || boundingbox.length !== 4) return RAIO_PADRAO_M
  const [south, north, west, east] = boundingbox.map(Number)
  if ([south, north, west, east].some(Number.isNaN)) return RAIO_PADRAO_M
  const diagonal = distanciaMetros(south, west, north, east)
  const raio = diagonal / 2
  return Math.max(RAIO_MINIMO_M, Math.min(RAIO_MAXIMO_M, Math.round(raio)))
}

/**
 * Monta a query Overpass QL. Com tags conhecidas (ver segmentosOsm.js),
 * busca por categoria (precisa); sem correspondência, cai para um filtro de
 * nome livre (menos preciso, documentado como limitação — nunca bloqueia a
 * busca por segmento desconhecido).
 * @param {Array<{k:string,v:string}>|null} tags
 * @param {string} segmentoTexto - usado só no fallback de nome livre
 * @param {number} lat
 * @param {number} lon
 * @param {number} raioMetros
 */
export function montarQueryOverpass(tags, segmentoTexto, lat, lon, raioMetros) {
  const filtros = tags?.length
    ? tags.map((t) => `  nwr["${t.k}"="${t.v}"](around:${raioMetros},${lat},${lon});`).join('\n')
    : `  nwr["name"~"${String(segmentoTexto || '').replace(/"/g, '')}",i](around:${raioMetros},${lat},${lon});`
  return `[out:json][timeout:25];\n(\n${filtros}\n);\nout center tags;`
}

/**
 * Converte um elemento do Overpass no mesmo formato "Entry" que o
 * Normalizer.js já espera (herdado do gosom/google-maps-scraper) — o
 * contrato de normalização NÃO muda com a troca de provider, só este
 * mapeamento de campo.
 * @param {Object} elemento - elemento bruto do Overpass (node|way|relation)
 */
export function elementoParaEntry(elemento) {
  const tags = elemento.tags || {}
  const lat = elemento.lat ?? elemento.center?.lat ?? null
  const lon = elemento.lon ?? elemento.center?.lon ?? null
  const enderecoPartes = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean)

  return {
    place_id: `osm:${elemento.type}/${elemento.id}`,
    title: tags.name || null,
    category: tags.shop || tags.amenity || tags.office || tags.leisure || tags.healthcare || null,
    address: enderecoPartes.length ? enderecoPartes.join(', ') : null,
    complete_address: {
      borough: tags['addr:suburb'] || tags['addr:neighbourhood'] || null,
      city: tags['addr:city'] || null,
      state: tags['addr:state'] || null,
    },
    phone: tags.phone || tags['contact:phone'] || null,
    web_site: tags.website || tags['contact:website'] || null,
    // OpenStreetMap não é uma plataforma de avaliações — nunca inventamos
    // rating/quantidade de avaliações a partir de outro dado.
    review_rating: null,
    review_count: null,
    latitude: typeof lat === 'number' ? lat : null,
    longtitude: typeof lon === 'number' ? lon : null, // nome mantido (typo original do contrato Entry) por compatibilidade com Normalizer.js
    emails: tags.email ? [tags.email] : [],
  }
}

async function geocodificar(localizacao) {
  const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(localizacao)}`
  const resp = await fetchComTimeout(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } }, TIMEOUT_NOMINATIM_MS)
  if (!resp.ok) throw new Error(`Nominatim respondeu ${resp.status}`)
  const dados = await resp.json()
  if (!Array.isArray(dados) || dados.length === 0) return null
  const { lat, lon, boundingbox } = dados[0]
  return { lat: Number(lat), lon: Number(lon), raioMetros: raioDeBoundingBox(boundingbox) }
}

async function consultarOverpass(query) {
  const resp = await fetchComTimeout(
    OVERPASS_URL,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT }, body: `data=${encodeURIComponent(query)}` },
    TIMEOUT_OVERPASS_MS
  )
  if (!resp.ok) throw new Error(`Overpass respondeu ${resp.status}`)
  const dados = await resp.json()
  return Array.isArray(dados.elements) ? dados.elements : []
}

/**
 * @param {import('./DiscoveryProvider').ParametrosBusca} parametros
 * @returns {Promise<import('./DiscoveryProvider').ResultadoBrutoProvider>}
 */
export async function buscar({ segmento, localizacao, quantidade }) {
  const inicio = Date.now()

  let ponto
  try {
    ponto = await geocodificar(localizacao)
  } catch (erro) {
    // PROVIDER_INDISPONIVEL — não conseguimos nem consultar a fonte, nunca
    // tratado como "zero resultados" (são estados diferentes, item 14).
    return { registros: [], provider: 'openstreetmap', status: 'indisponivel', mensagemErro: `Geocodificação falhou: ${erro.message}`, duracaoMs: Date.now() - inicio }
  }
  if (!ponto) {
    // Nominatim respondeu, mas não reconheceu a localização digitada — isso
    // é cobertura, não indisponibilidade: a fonte funcionou, só não achou
    // esse lugar.
    return { registros: [], provider: 'openstreetmap', status: 'sem_cobertura', mensagemErro: 'Localização não reconhecida pela fonte de geocodificação.', duracaoMs: Date.now() - inicio }
  }

  const tags = tagsParaSegmento(segmento)
  const query = montarQueryOverpass(tags, segmento, ponto.lat, ponto.lon, ponto.raioMetros)

  let elementos
  try {
    elementos = await consultarOverpass(query)
  } catch (erro) {
    return { registros: [], provider: 'openstreetmap', status: 'indisponivel', mensagemErro: `Consulta à fonte de descoberta falhou: ${erro.message}`, duracaoMs: Date.now() - inicio }
  }

  const limite = Math.max(1, Math.min(50, Number(quantidade) || 20))
  const registros = elementos
    .filter((el) => el.tags?.name) // sem nome não é um resultado útil pra exibir
    .slice(0, limite)
    .map(elementoParaEntry)

  return {
    registros,
    provider: 'openstreetmap',
    status: registros.length ? 'ok' : 'sem_resultado',
    duracaoMs: Date.now() - inicio,
    queryUsada: `${segmento} in ${localizacao}`,
    metadados: { pontoGeocodificado: { lat: ponto.lat, lon: ponto.lon }, raioMetros: ponto.raioMetros, tagsUsadas: tags, elementosBrutos: elementos.length },
  }
}

export const _internos = { semAcento, distanciaMetros }
