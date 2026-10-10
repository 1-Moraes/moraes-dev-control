// GroqProvider — provider PRINCIPAL a partir do ajuste de prioridade
// "custo zero" (ver AIOrchestrator.js): GroqCloud expõe modelos abertos
// (Llama/GPT-OSS/Qwen) numa API compatível com o formato Chat Completions
// da OpenAI, com uma camada gratuita que, pelo conhecimento disponível,
// não exige cartão de crédito para começar (a documentação pública não
// declara isso explicitamente — confirmar pessoalmente no cadastro, ver
// relatório desta fase). Mesmo racional
// de fetch direto (sem SDK dedicado) do AnthropicProvider.js/
// OpenAIProvider.js.
//
// Modelo: NUNCA hardcoded aqui — vem de GROQ_MODEL (env, server-side), que
// deve ser preenchido com um modelo do plano gratuito do Groq (confirmar
// em https://console.groq.com/docs/models e https://console.groq.com/docs/rate-limits
// antes de configurar — ex.: llama-3.1-8b-instant, llama-3.3-70b-versatile,
// openai/gpt-oss-20b, no momento em que este provider foi escrito). Este
// arquivo não impõe nem valida qual modelo é "gratuito" — isso depende da
// conta Groq e pode mudar; quem configura GROQ_MODEL é responsável por
// escolher um modelo coberto pelo free tier.
import { ProviderError } from './ProviderError.js'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export const nome = 'groq'

export function configurado() {
  return Boolean(process.env.GROQ_API_KEY && process.env.GROQ_MODEL)
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
  const apiKey = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL

  if (!apiKey || !model) {
    throw new ProviderError('credencial_ausente', 'GROQ_API_KEY ou GROQ_MODEL não configurados neste ambiente.')
  }

  const inicio = Date.now()
  let resp
  try {
    resp = await fetchComTimeout(
      GROQ_API_URL,
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
    throw new ProviderError('indisponivel', `Falha ao consultar Groq: ${erro.name === 'AbortError' ? 'timeout' : erro.message}`)
  }

  if (resp.status === 401 || resp.status === 403) {
    throw new ProviderError('credencial_invalida', `Groq rejeitou a credencial (HTTP ${resp.status}).`)
  }
  if (resp.status === 429) {
    // No free tier, 429 cobre tanto "rate limit por minuto" quanto "cota
    // diária/mensal gratuita esgotada" — Groq não distingue isso no status
    // HTTP. Tratado sempre como `limite` (retryable: AIOrchestrator pode
    // tentar o próximo provider gratuito da lista, nunca um pago).
    throw new ProviderError('limite', 'Groq sinalizou limite de uso do free tier (HTTP 429).')
  }
  if (resp.status >= 500) {
    throw new ProviderError('indisponivel', `Groq indisponível (HTTP ${resp.status}).`)
  }
  if (!resp.ok) {
    throw new ProviderError('desconhecido', `Groq respondeu HTTP ${resp.status} (não classificado).`)
  }

  let dados
  try {
    dados = await resp.json()
  } catch {
    throw new ProviderError('resposta_invalida', 'Groq respondeu um corpo que não é JSON válido.')
  }

  const texto = dados.choices?.[0]?.message?.content
  if (typeof texto !== 'string') {
    throw new ProviderError('resposta_invalida', 'Resposta da Groq não contém conteúdo de mensagem.')
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
