// Contrato abstrato de descoberta de leads — Fase 2B (item 4 do
// planejamento). Mesmo espírito de src/lib/ai/AIService.js: este arquivo só
// registra a FORMA da interface. Roda exclusivamente do lado do servidor
// (dentro de api/radar-buscar.js), nunca no bundle do frontend — o React
// nunca importa nada de src/lib/radar/providers/ diretamente.
//
// Qualquer provider real (GoogleMapsScraperProvider, e futuramente
// GooglePlacesProvider) implementa este mesmo contrato, para que o
// DiscoveryService possa trocar de provider sem o resto do pipeline
// (Normalizer, Deduplicator, frontend) saber qual está por trás.
//
//   DiscoveryProvider
//      ├── GoogleMapsScraperProvider  (implementado nesta fase, MODO LAB)
//      └── GooglePlacesProvider        (futuro — não implementado)

/**
 * @typedef {Object} ParametrosBusca
 * @property {string} segmento - texto livre, ex.: "Barbearias", "Dentistas"
 * @property {string} localizacao - cidade/região, ex.: "Cotia, SP"
 * @property {number} quantidade - alvo aproximado de resultados (10/20/50)
 */

/**
 * @typedef {Object} ResultadoBrutoProvider
 * @property {Array<Object>} registros - registros brutos no formato nativo do provider (ex.: Entry do gosom/google-maps-scraper)
 * @property {string} provider - identificador do provider usado
 * @property {'ok'|'sem_resultado'|'erro'|'bloqueio'} status
 * @property {string} [mensagemErro]
 * @property {number} duracaoMs
 */

/**
 * Contrato que todo DiscoveryProvider deve implementar.
 * @param {ParametrosBusca} parametros
 * @returns {Promise<ResultadoBrutoProvider>}
 */
// eslint-disable-next-line no-unused-vars -- parâmetro faz parte do contrato da interface
export async function buscar(_parametros) {
  throw new Error(
    'DiscoveryProvider.buscar() é só a interface — use um provider concreto ' +
      '(ex.: GoogleMapsScraperProvider), nunca esta função diretamente.'
  )
}
