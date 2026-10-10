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

const DETALHE_ERRO_MAX_LEN = 200

// Lê o corpo de uma resposta não-OK da Groq pra extrair o motivo real que
// ela reportou (`error.code`/`error.message` no formato OpenAI-compatible
// que a Groq usa, ex.: `model_not_found`/"The model `x` does not exist or
// you do not have access to it."). Nunca lança — se o corpo não vier, não
// for JSON, ou não tiver o formato esperado, devolve null e o provider cai
// de volta pra mensagem genérica com só o status HTTP. O corpo de erro da
// Groq nunca contém a API key (ela só vai no header da requisição), mas o
// resultado é truncado e tem quebras de linha removidas por segurança antes
// de ir pro log (`ai_logs.erro`, que também é truncado a 300 caracteres em
// api/ia-radar.js).
async function extrairDetalheErro(resp) {
  try {
    const dados = await resp.json()
    const bruto = [dados?.error?.code, dados?.error?.message].filter(Boolean).join(': ')
    if (!bruto) return null
    return bruto.replace(/\s+/g, ' ').trim().slice(0, DETALHE_ERRO_MAX_LEN)
  } catch {
    return null
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

  if (!resp.ok) {
    // Diagnóstico definitivo do 502 investigado em produção (requestId
    // 1474521c-8236-4c3a-a45e-be7022a5d11b): a Groq respondeu HTTP 404 e,
    // até esta correção, o provider nunca lia o corpo do erro — só o
    // status HTTP ia pro log (`ai_logs.erro`), então não havia como saber
    // SE a causa era "modelo inexistente/descontinuado" (o que a Groq
    // normalmente sinaliza com um corpo JSON `{error:{code,message}}` em
    // respostas não-OK, inclusive 404) ou outra coisa qualquer. Lê e
    // sanitiza esse corpo uma única vez, pra toda classificação de erro
    // abaixo poder incluir o motivo real que a própria Groq devolveu —
    // nunca a API key (que nunca aparece no corpo, só no header enviado).
    const detalheGroq = await extrairDetalheErro(resp)
    const sufixoDetalhe = detalheGroq ? ` Detalhe da Groq: ${detalheGroq}` : ''

    if (resp.status === 401 || resp.status === 403) {
      throw new ProviderError('credencial_invalida', `Groq rejeitou a credencial (HTTP ${resp.status}).${sufixoDetalhe}`, { statusHttp: resp.status, modelo: model })
    }
    if (resp.status === 429) {
      // No free tier, 429 cobre tanto "rate limit por minuto" quanto "cota
      // diária/mensal gratuita esgotada" — Groq não distingue isso no status
      // HTTP. Tratado sempre como `limite` (retryable: AIOrchestrator pode
      // tentar o próximo provider gratuito da lista, nunca um pago).
      throw new ProviderError('limite', `Groq sinalizou limite de uso do free tier (HTTP 429).${sufixoDetalhe}`, { statusHttp: resp.status, modelo: model })
    }
    if (resp.status >= 500) {
      throw new ProviderError('indisponivel', `Groq indisponível (HTTP ${resp.status}).${sufixoDetalhe}`, { statusHttp: resp.status, modelo: model })
    }
    // Inclui o 404 de "modelo não encontrado/descontinuado" (o caso real
    // investigado) — continua `desconhecido` porque a Groq não distingue
    // isso de outro 4xx no status HTTP, só no corpo (agora capturado acima).
    throw new ProviderError('desconhecido', `Groq respondeu HTTP ${resp.status} (não classificado).${sufixoDetalhe}`, { statusHttp: resp.status, modelo: model })
  }

  let dados
  try {
    dados = await resp.json()
  } catch {
    throw new ProviderError('resposta_invalida', 'Groq respondeu um corpo que não é JSON válido.', { statusHttp: resp.status, etapa: 'parse_resposta', modelo: model })
  }

  const texto = dados.choices?.[0]?.message?.content
  if (typeof texto !== 'string') {
    throw new ProviderError('resposta_invalida', 'Resposta da Groq não contém conteúdo de mensagem.', { statusHttp: resp.status, etapa: 'parse_resposta', modelo: model })
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
