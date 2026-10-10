// AIOrchestrator — seleção de provider + fallback controlado (Fase 3B,
// itens 5 e 7 do planejamento). Mesmo papel que DiscoveryService.js tem
// para o Radar (Fase 3A): este arquivo é o ÚNICO lugar que decide QUAL
// provider de IA usar e em que ordem tentar — api/ia-radar.js (a Vercel
// Function) chama só isto, nunca os providers diretamente. Roda
// exclusivamente server-side.
//
//   api/ia-radar.js
//        ↓
//   AIOrchestrator.executar()
//        ↓ seleciona via AI_PRIMARY_PROVIDER/AI_FALLBACK_PROVIDER (env)
//   GroqProvider  →  (se falha retryable/resposta_invalida)  →  GeminiProvider
//        ↓
//   { texto, provider, model, tokensEntrada, tokensSaida, duracaoMs }
//
// AJUSTE DE PRIORIDADE "CUSTO ZERO" (pedido explícito do João, depois da
// implementação original desta fase ter sido feita com Anthropic
// principal/OpenAI fallback): a ordem PADRÃO passou a ser Groq → Gemini,
// os dois com camada gratuita, para a Moraes.Dev Control poder operar com
// R$ 0 de custo inicial. Anthropic e OpenAI continuam implementados
// (AnthropicProvider.js/OpenAIProvider.js, item 3 do ajuste: "preservados
// como integrações futuras") mas ficam DESATIVADOS POR PADRÃO — só entram
// em jogo se alguém setar AI_PRIMARY_PROVIDER/AI_FALLBACK_PROVIDER
// explicitamente para 'anthropic'/'openai', uma decisão humana deliberada,
// nunca automática. Nenhum provider pago é tentado como fallback de um
// provider gratuito — a lista de candidatos nunca mistura os dois grupos
// a menos que a env var peça isso explicitamente.
//
// Fallback é CONTROLADO (item 7): só tenta o segundo provider quando o
// primeiro falha de um jeito que justifica tentar outro (credencial
// ausente/inválida, limite — inclui cota gratuita esgotada —,
// indisponibilidade, resposta inválida) — nunca em erro de validação da
// PRÓPRIA requisição (esse erro se repetiria em qualquer provider) e nunca
// chama os dois automaticamente "só para garantir" (isso dobraria o
// consumo sem necessidade, item 8). Quando TODOS os providers configurados
// falham (ex.: as duas cotas gratuitas esgotadas), o erro sobe classificado
// — api/ia-radar.js devolve um aviso claro e nunca deixa Radar/CRM
// dependerem disso para continuar funcionando (item 10 do ajuste).

import * as AnthropicProvider from './providers/AnthropicProvider.js'
import * as OpenAIProvider from './providers/OpenAIProvider.js'
import * as GroqProvider from './providers/GroqProvider.js'
import * as GeminiProvider from './providers/GeminiProvider.js'
import { ProviderError } from './providers/ProviderError.js'
import { obterLimites } from './limites.js'

const PROVIDERS = { groq: GroqProvider, gemini: GeminiProvider, anthropic: AnthropicProvider, openai: OpenAIProvider }

// Ordem padrão: só os dois gratuitos. Anthropic/OpenAI nunca entram aqui
// implicitamente — só se alguém setar as env vars explicitamente para eles.
const ORDEM_PADRAO = ['groq', 'gemini']

function ordemProviders() {
  const primario = process.env.AI_PRIMARY_PROVIDER || 'groq'
  const fallback = process.env.AI_FALLBACK_PROVIDER || 'gemini'
  const nomes = [primario, fallback].filter((n, i, arr) => PROVIDERS[n] && arr.indexOf(n) === i)
  return nomes.length ? nomes : ORDEM_PADRAO
}

/**
 * @returns {{algumConfigurado: boolean, providers: Array<{nome:string, configurado:boolean}>}}
 */
export function statusProviders() {
  const nomes = ordemProviders()
  const providers = nomes.map((n) => ({ nome: n, configurado: PROVIDERS[n].configurado() }))
  return { algumConfigurado: providers.some((p) => p.configurado), providers }
}

/**
 * @typedef {Object} RequisicaoIA
 * @property {string} sistemaPrompt
 * @property {string} mensagemUsuario
 * @property {number} maxTokens
 * @property {number} timeoutMs
 */

/**
 * @typedef {Object} RespostaIA
 * @property {string} texto
 * @property {string} provider
 * @property {string} model
 * @property {number|null} tokensEntrada
 * @property {number|null} tokensSaida
 * @property {number} duracaoMs
 */

/**
 * @param {{sistemaPrompt:string, mensagemUsuario:string}} requisicao
 * @returns {Promise<RespostaIA & {tentativas: Array<{provider:string, sucesso:boolean, tipoErro?:string}>}>}
 * @throws {ProviderError} quando nenhum provider configurado conseguiu responder
 */
export async function executar({ sistemaPrompt, mensagemUsuario }) {
  const limites = obterLimites()
  const nomes = ordemProviders()
  const tentativas = []
  let ultimoErro = null

  for (let i = 0; i < nomes.length; i++) {
    const provider = PROVIDERS[nomes[i]]
    if (!provider.configurado()) {
      tentativas.push({ provider: nomes[i], sucesso: false, tipoErro: 'credencial_ausente' })
      ultimoErro = new ProviderError('credencial_ausente', `${nomes[i]} não configurado.`)
      continue
    }

    try {
      const resposta = await provider.gerar({
        sistemaPrompt,
        mensagemUsuario,
        maxTokens: limites.maxTokensResposta,
        timeoutMs: limites.timeoutMs,
      })
      tentativas.push({ provider: nomes[i], sucesso: true })
      return { ...resposta, tentativas }
    } catch (erro) {
      const erroClassificado = erro instanceof ProviderError ? erro : new ProviderError('desconhecido', erro.message)
      tentativas.push({ provider: nomes[i], sucesso: false, tipoErro: erroClassificado.tipo })
      ultimoErro = erroClassificado

      const haProximoProvider = i < nomes.length - 1
      if (!haProximoProvider || !erroClassificado.podeTentarOutroProvider) {
        throw Object.assign(ultimoErro, { tentativas })
      }
      // podeTentarOutroProvider=true e existe próximo — continua o loop
      // (fallback controlado, nunca um retry no MESMO provider: item 7).
    }
  }

  throw Object.assign(ultimoErro || new ProviderError('credencial_ausente', 'Nenhum provider de IA configurado.'), { tentativas })
}
