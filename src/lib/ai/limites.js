// Limites de consumo — Fase 3B, item 9 do planejamento: "não confiar em
// limites enviados pelo frontend", "configuração centralizada". Lido só
// server-side (api/ia-radar.js / AIOrchestrator.js). Valores default são
// ponto de partida conservador, documentados como tal — nunca uma
// invenção de custo real (isso é section 8/27: nunca inventar preço),
// apenas um teto operacional para não deixar a rota aberta sem limite
// nenhum enquanto nenhuma credencial paga está configurada.

function numEnv(nome, padrao) {
  const v = process.env[nome]
  const n = Number(v)
  return v && Number.isFinite(n) && n > 0 ? n : padrao
}

export function obterLimites() {
  return {
    maxTokensResposta: numEnv('AI_MAX_TOKENS_RESPOSTA', 1500),
    timeoutMs: numEnv('AI_TIMEOUT_MS', 20000),
    maxTentativasPorProvider: 1, // nunca repetir automaticamente no MESMO provider (item 7) — só o fallback entre providers conta como "segunda tentativa"
    limiteRequisicoesPorUsuarioPorHora: numEnv('AI_LIMITE_REQUISICOES_USUARIO_HORA', 30),
    tamanhoMaximoPayloadBytes: numEnv('AI_TAMANHO_MAX_PAYLOAD_BYTES', 20000),
  }
}
