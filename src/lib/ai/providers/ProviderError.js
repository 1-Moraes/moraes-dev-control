// ProviderError — taxonomia de erro usada por todo provider de IA (Fase 3B,
// item 7 do planejamento: "fallback controlado, não repetir em toda
// falha"). Cada provider classifica sua própria falha num destes tipos;
// AIOrchestrator.js decide com base em `retryable` (nunca na mensagem de
// texto, que pode variar entre versões de API).
//
//   credencial_ausente — API key não configurada neste ambiente. Nunca
//                         retryable (não existe "tentar de novo" sem chave).
//   credencial_invalida — API key configurada, mas rejeitada pelo
//                         provedor (401/403). Nunca retryable.
//   validacao           — parâmetros inválidos antes mesmo de chamar a API
//                         (ex.: prompt vazio). Nunca retryable.
//   limite              — rate limit / orçamento do provedor (429).
//                         Retryable — é exatamente o caso em que faz
//                         sentido tentar o outro provedor.
//   indisponivel        — timeout, erro de rede, 5xx do provedor.
//                         Retryable.
//   resposta_invalida   — o provedor respondeu, mas o conteúdo não é o
//                         esperado (JSON malformado, schema não bate).
//                         NÃO retryable para o MESMO provider com o mesmo
//                         prompt (repetir não muda o resultado), mas
//                         AIOrchestrator ainda pode tentar o outro
//                         provider, que pode ter melhor sorte.
//   desconhecido        — qualquer falha não classificada. Nunca retryable
//                         por padrão (mais seguro que assumir que pode
//                         tentar de novo).

export const TIPOS_ERRO_PROVIDER = [
  'credencial_ausente',
  'credencial_invalida',
  'validacao',
  'limite',
  'indisponivel',
  'resposta_invalida',
  'desconhecido',
]

const RETRYABLE = new Set(['limite', 'indisponivel'])

export class ProviderError extends Error {
  /**
   * @param {string} tipo - um de TIPOS_ERRO_PROVIDER
   * @param {string} mensagem - mensagem segura para log (nunca inclui a API key)
   * @param {Object} [opts]
   * @param {boolean} [opts.podeTentarOutroProvider] - força a decisão de fallback independente do tipo (ex.: resposta_invalida ainda permite tentar o outro provider)
   * @param {number} [opts.statusHttp] - status HTTP cru devolvido pelo provedor, quando a falha vier de uma resposta HTTP (diagnóstico — nunca usado para decidir fallback, só para log/observabilidade, ver api/ia-radar.js)
   * @param {string} [opts.etapa] - em que etapa do pipeline a falha ocorreu ('chamada_provider' | 'parse_resposta' | 'validacao_schema'), usado só para diagnóstico/log
   * @param {string} [opts.modelo] - identificador do modelo (env var do provider, ex.: GROQ_MODEL) que estava configurado no momento da falha — diagnóstico (investigação do 502 de produção descobriu que, sem isto, `ai_logs.model` ficava sempre "desconhecido" em qualquer falha de provider, mesmo quando o modelo configurado era exatamente a causa)
   */
  constructor(tipo, mensagem, { podeTentarOutroProvider, statusHttp, etapa, modelo } = {}) {
    super(mensagem)
    this.name = 'ProviderError'
    this.tipo = TIPOS_ERRO_PROVIDER.includes(tipo) ? tipo : 'desconhecido'
    this.retryable = RETRYABLE.has(this.tipo)
    this.podeTentarOutroProvider = podeTentarOutroProvider ?? (this.retryable || this.tipo === 'resposta_invalida')
    this.statusHttp = statusHttp ?? null
    this.etapa = etapa || 'chamada_provider'
    this.modelo = modelo ?? null
  }
}
