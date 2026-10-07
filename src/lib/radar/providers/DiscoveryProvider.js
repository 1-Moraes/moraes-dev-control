// Contrato abstrato de descoberta de leads — Fase 2B (item 4 do
// planejamento), com os status ampliados no ajuste da Fase 3A ("busca
// dinâmica por localidade", item 14: distinguir sem-resultado de
// sem-cobertura de indisponível). Mesmo espírito de src/lib/ai/AIService.js:
// este arquivo só registra a FORMA da interface. Roda exclusivamente do
// lado do servidor (dentro de api/radar-buscar.js), nunca no bundle do
// frontend — o React nunca importa nada de src/lib/radar/providers/
// diretamente.
//
// Qualquer provider implementa este mesmo contrato, para que o
// DiscoveryService possa trocar de provider (via DISCOVERY_PROVIDER, ver
// esse arquivo) sem o resto do pipeline (Normalizer, Deduplicator,
// frontend) saber qual está por trás.
//
//   DiscoveryProvider
//      ├── OpenStreetMapProvider     (provider real/dinâmico — padrão desde a Fase 3A)
//      └── FixtureDiscoveryProvider  (catálogo fixo — dev/teste/fallback explícito)

/**
 * @typedef {Object} ParametrosBusca
 * @property {string} segmento - texto livre, ex.: "Barbearias", "Dentistas"
 * @property {string} localizacao - cidade/região, ex.: "Cotia, SP", "Alphaville, Barueri - SP"
 * @property {number} quantidade - alvo aproximado de resultados (10/20/50)
 */

/**
 * @typedef {Object} ResultadoBrutoProvider
 * @property {Array<Object>} registros - registros brutos no formato "Entry" (herdado do gosom/google-maps-scraper; todo provider converte pra esse shape)
 * @property {string} provider - identificador do provider usado
 * @property {'ok'|'sem_resultado'|'sem_cobertura'|'indisponivel'|'erro'|'bloqueio'} status
 *   - ok: busca executada, com resultados.
 *   - sem_resultado: busca executada na fonte, zero resultados — a fonte funcionou, só não há negócios ali.
 *   - sem_cobertura: a fonte não tem cobertura pra essa combinação/localização (ex.: não reconheceu a localização).
 *   - indisponivel: não foi possível consultar a fonte agora (rede/timeout/resposta inválida).
 *   - erro: falha inesperada não classificada.
 *   - bloqueio: a fonte recusou/limitou a consulta (rate limit, etc.).
 * @property {string} [mensagemErro]
 * @property {Object} [metadados] - diagnóstico (ponto geocodificado, raio, tags usadas etc.) — nunca exibido cru ao usuário
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
      '(ex.: OpenStreetMapProvider), nunca esta função diretamente.'
  )
}
