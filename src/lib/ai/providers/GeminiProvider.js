// GeminiProvider — provider de FALLBACK a partir do ajuste de prioridade
// "custo zero" (ver AIOrchestrator.js): Google AI Studio / Gemini API.
// Formato de requisição diferente do padrão OpenAI-compatible usado por
// Groq/OpenAI (generateContent, não chat/completions) — por isso este
// provider monta o corpo próprio em vez de reaproveitar a forma dos
// outros.
//
// AVISO DE PRIVACIDADE (item explícito do planejamento — "não enviar
// dados confidenciais de clientes a modelos gratuitos de terceiros sem
// avaliar as condições de privacidade"): o free tier do Google AI
// Studio/Gemini API, segundo a documentação pública, permite que o
// conteúdo enviado seja usado pela Google para melhorar produtos (política
// diferente do tier pago). Por isso este provider só pode receber o que
// sanitizarDadosEmpresa.js já reduziu a dados mínimos e não-identificáveis
// do NEGÓCIO (nome da empresa, segmento, cidade/estado, booleans, score) —
// nunca telefone/e-mail/endereço completo/nome de pessoa física. Nenhuma
// mudança deste provider pode contornar essa minimização.
//
// Modelo: NUNCA hardcoded aqui — vem de GEMINI_MODEL (env, server-side),
// que deve ser preenchido com um modelo do Free Tier (confirmar em
// https://ai.google.dev/gemini-api/docs/pricing antes de configurar — ex.:
// gemini-2.5-flash ou gemini-2.5-flash-lite, confirmados "Free of charge"
// no momento em que este provider foi escrito). Este arquivo não impõe
// nem valida qual modelo é "gratuito" — isso depende da conta/região e
// pode mudar; quem configura GEMINI_MODEL é responsável por escolher um
// modelo coberto pelo Free Tier.
import { ProviderError } from './ProviderError.js'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export const nome = 'gemini'

export function configurado() {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL)
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
 * @param {import('../AIOrchestrator.js').RequisicaoIA} requisicao
 * @returns {Promise<import('../AIOrchestrator.js').RespostaIA>}
 */
export async function gerar({ sistemaPrompt, mensagemUsuario, maxTokens, timeoutMs }) {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL

  if (!apiKey || !model) {
    throw new ProviderError('credencial_ausente', 'GEMINI_API_KEY ou GEMINI_MODEL não configurados neste ambiente.')
  }

  const inicio = Date.now()
  let resp
  try {
    resp = await fetchComTimeout(
      // A chave vai na query string por exigência da própria API do
      // Google (não existe alternativa de header documentada para esta
      // rota) — nunca logada, nunca repassada ao cliente (ver
      // api/ia-radar.js, que nunca inclui a URL/erro cru na resposta).
      `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sistemaPrompt }] },
          contents: [{ role: 'user', parts: [{ text: mensagemUsuario }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      },
      timeoutMs
    )
  } catch (erro) {
    throw new ProviderError('indisponivel', `Falha ao consultar Gemini: ${erro.name === 'AbortError' ? 'timeout' : erro.message}`)
  }

  if (resp.status === 401 || resp.status === 403) {
    throw new ProviderError('credencial_invalida', `Gemini rejeitou a credencial (HTTP ${resp.status}).`)
  }
  if (resp.status === 429) {
    throw new ProviderError('limite', 'Gemini sinalizou limite de uso do Free Tier (HTTP 429).')
  }
  if (resp.status >= 500) {
    throw new ProviderError('indisponivel', `Gemini indisponível (HTTP ${resp.status}).`)
  }
  if (!resp.ok) {
    throw new ProviderError('desconhecido', `Gemini respondeu HTTP ${resp.status} (não classificado).`)
  }

  let dados
  try {
    dados = await resp.json()
  } catch {
    throw new ProviderError('resposta_invalida', 'Gemini respondeu um corpo que não é JSON válido.')
  }

  // Gemini pode devolver 200 com `candidates` vazio (ex.: bloqueado por
  // safety filter) — isso também é "sem texto utilizável", mesmo
  // tratamento de resposta_invalida dado a um corpo malformado.
  const partes = dados.candidates?.[0]?.content?.parts
  const texto = Array.isArray(partes) ? partes.map((p) => p.text).filter((t) => typeof t === 'string').join('') : undefined
  if (!texto) {
    throw new ProviderError('resposta_invalida', 'Resposta da Gemini não contém conteúdo de texto utilizável.')
  }

  return {
    texto,
    provider: nome,
    model,
    tokensEntrada: dados.usageMetadata?.promptTokenCount ?? null,
    tokensSaida: dados.usageMetadata?.candidatesTokenCount ?? null,
    duracaoMs: Date.now() - inicio,
  }
}
