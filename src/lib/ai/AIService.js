// Interface abstrata de IA — item 16 do planejamento.
//
// NÃO INTEGRA NENHUM PROVIDER NESTA FASE. Este arquivo existe só para
// registrar a forma da interface, sem chamar nenhuma API externa.
//
// Regras que valem desde já, mesmo sem nada implementado:
//   - toda chamada real a um provider deve acontecer numa Vercel Function
//     (server-side), nunca aqui — este arquivo roda no navegador.
//   - nenhuma API key (Anthropic, OpenAI, etc.) pode existir no frontend.
//   - a interface recebe "feature" (de onde a chamada partiu, ex.:
//     "score-lead", "rascunho-whatsapp") para alimentar ai_logs sem
//     guardar prompt/resposta completos por padrão (ver item 17).
//
// Quando a Fase 6 for autorizada, cada provider real (AnthropicProvider,
// OpenAIProvider) vai implementar este mesmo contrato em
// src/lib/ai/providers/, e a função server-side (api/ai-proxy.js, ainda
// não criada) escolhe qual provider usar.

/**
 * @typedef {Object} AIRequest
 * @property {string} feature - identifica de onde partiu a chamada (para ai_logs)
 * @property {string} prompt
 * @property {Object} [contexto]
 */

/**
 * @typedef {Object} AIResponse
 * @property {string} texto
 * @property {string} provider
 * @property {string} model
 * @property {number} tokensEntrada
 * @property {number} tokensSaida
 */

/**
 * Contrato que todo provider deve implementar. Não é chamado diretamente
 * pelo frontend — fica atrás de uma Vercel Function.
 * @param {AIRequest} requisicao
 * @returns {Promise<AIResponse>}
 */
// eslint-disable-next-line no-unused-vars -- parâmetro faz parte do contrato da interface, ainda sem implementação real
export async function gerar(_requisicao) {
  throw new Error(
    'AIService.gerar() é só a interface — nenhum provider foi integrado nesta fase. ' +
      'Ver src/lib/ai/providers/ (vazio) e o item 16 do planejamento do Moraes.Dev Control.'
  )
}
