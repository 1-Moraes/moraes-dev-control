// OpenAIProvider — provider ALTERNATIVO (fallback), mesmo racional do
// AnthropicProvider.js: fetch direto na Chat Completions API, sem SDK
// dedicado, modelo nunca hardcoded (vem de OPENAI_MODEL, server-side).
import { ProviderError } from './ProviderError.js'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

export const nome = 'openai'

export function configurado() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL)
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
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL

  if (!apiKey || !model) {
    throw new ProviderError('credencial_ausente', 'OPENAI_API_KEY ou OPENAI_MODEL não configurados neste ambiente.')
  }

  const inicio = Date.now()
  let resp
  try {
    resp = await fetchComTimeout(
      OPENAI_API_URL,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: sistemaPrompt },
            { role: 'user', content: mensagemUsuario },
          ],
        }),
      },
      timeoutMs
    )
  } catch (erro) {
    throw new ProviderError('indisponivel', `Falha ao consultar OpenAI: ${erro.name === 'AbortError' ? 'timeout' : erro.message}`)
  }

  if (resp.status === 401 || resp.status === 403) {
    throw new ProviderError('credencial_invalida', `OpenAI rejeitou a credencial (HTTP ${resp.status}).`, { statusHttp: resp.status })
  }
  if (resp.status === 429) {
    throw new ProviderError('limite', 'OpenAI sinalizou limite de uso (HTTP 429).', { statusHttp: resp.status })
  }
  if (resp.status >= 500) {
    throw new ProviderError('indisponivel', `OpenAI indisponível (HTTP ${resp.status}).`, { statusHttp: resp.status })
  }
  if (!resp.ok) {
    throw new ProviderError('desconhecido', `OpenAI respondeu HTTP ${resp.status} (não classificado).`, { statusHttp: resp.status })
  }

  let dados
  try {
    dados = await resp.json()
  } catch {
    throw new ProviderError('resposta_invalida', 'OpenAI respondeu um corpo que não é JSON válido.', { statusHttp: resp.status, etapa: 'parse_resposta' })
  }

  const texto = dados.choices?.[0]?.message?.content
  if (typeof texto !== 'string') {
    throw new ProviderError('resposta_invalida', 'Resposta da OpenAI não contém conteúdo de mensagem.', { statusHttp: resp.status, etapa: 'parse_resposta' })
  }

  return {
    texto,
    provider: nome,
    model,
    tokensEntrada: dados.usage?.prompt_tokens ?? null,
    tokensSaida: dados.usage?.completion_tokens ?? null,
    duracaoMs: Date.now() - inicio,
  }
}
