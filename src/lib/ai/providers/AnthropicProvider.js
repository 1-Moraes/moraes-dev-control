// AnthropicProvider — implementação real do contrato de provider de IA
// (Fase 3B). Roda SÓ server-side (importado por src/lib/ai/AIOrchestrator.js,
// que por sua vez só é importado por api/ia-radar.js — nunca pelo bundle
// Vite). Usa fetch direto na Messages API da Anthropic em vez do SDK
// (@anthropic-ai/sdk) para não adicionar uma dependência só para um único
// endpoint HTTP simples — mesmo racional de OpenStreetMapProvider.js (Fase
// 3A) usar fetch em vez de instalar um cliente dedicado.
//
// Modelo: NUNCA hardcoded aqui — vem de ANTHROPIC_MODEL (env, server-side).
// Item 6 do planejamento: "não inventar valores de modelo". Sem essa env
// var configurada, este provider se recusa a rodar (erro `credencial_ausente`,
// mesmo tratamento de "não configurado" dado à ausência de API key) em vez
// de adivinhar um identificador de modelo.

import { ProviderError } from './ProviderError.js'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

export const nome = 'anthropic'

export function configurado() {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL)
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
  const apiKey = process.env.ANTHROPIC_API_KEY
  const model = process.env.ANTHROPIC_MODEL

  if (!apiKey || !model) {
    throw new ProviderError('credencial_ausente', 'ANTHROPIC_API_KEY ou ANTHROPIC_MODEL não configurados neste ambiente.')
  }

  const inicio = Date.now()
  let resp
  try {
    resp = await fetchComTimeout(
      ANTHROPIC_API_URL,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: sistemaPrompt,
          messages: [{ role: 'user', content: mensagemUsuario }],
        }),
      },
      timeoutMs
    )
  } catch (erro) {
    // AbortError (timeout) ou falha de rede — nunca expõe a API key no erro.
    throw new ProviderError('indisponivel', `Falha ao consultar Anthropic: ${erro.name === 'AbortError' ? 'timeout' : erro.message}`)
  }

  if (resp.status === 401 || resp.status === 403) {
    throw new ProviderError('credencial_invalida', `Anthropic rejeitou a credencial (HTTP ${resp.status}).`, { statusHttp: resp.status })
  }
  if (resp.status === 429) {
    throw new ProviderError('limite', 'Anthropic sinalizou limite de uso (HTTP 429).', { statusHttp: resp.status })
  }
  if (resp.status >= 500) {
    throw new ProviderError('indisponivel', `Anthropic indisponível (HTTP ${resp.status}).`, { statusHttp: resp.status })
  }
  if (!resp.ok) {
    throw new ProviderError('desconhecido', `Anthropic respondeu HTTP ${resp.status} (não classificado).`, { statusHttp: resp.status })
  }

  let dados
  try {
    dados = await resp.json()
  } catch {
    throw new ProviderError('resposta_invalida', 'Anthropic respondeu um corpo que não é JSON válido.', { statusHttp: resp.status, etapa: 'parse_resposta' })
  }

  const texto = dados.content?.find((bloco) => bloco.type === 'text')?.text
  if (typeof texto !== 'string') {
    throw new ProviderError('resposta_invalida', 'Resposta da Anthropic não contém um bloco de texto.', { statusHttp: resp.status, etapa: 'parse_resposta' })
  }

  return {
    texto,
    provider: nome,
    model,
    tokensEntrada: dados.usage?.input_tokens ?? null,
    tokensSaida: dados.usage?.output_tokens ?? null,
    duracaoMs: Date.now() - inicio,
  }
}
