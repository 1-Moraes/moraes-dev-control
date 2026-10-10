import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as AnthropicProvider from '../providers/AnthropicProvider'
import * as OpenAIProvider from '../providers/OpenAIProvider'
import { ProviderError } from '../providers/ProviderError'

// Nenhum teste aqui faz uma chamada real/paga — fetch é sempre mockado
// (item 34 do planejamento: "não realizar chamadas pagas nos testes
// automatizados").

const ENV_ORIGINAL = { ...process.env }

function limparEnvIA() {
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_MODEL
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_MODEL
}

describe('AnthropicProvider', () => {
  beforeEach(() => {
    limparEnvIA()
    global.fetch = vi.fn()
  })
  afterEach(() => {
    process.env = { ...ENV_ORIGINAL }
    vi.restoreAllMocks()
  })

  it('configurado() é false sem ANTHROPIC_API_KEY/ANTHROPIC_MODEL', () => {
    expect(AnthropicProvider.configurado()).toBe(false)
  })

  it('gerar() lança credencial_ausente sem chamar fetch quando não configurado', async () => {
    await expect(AnthropicProvider.gerar({ sistemaPrompt: 's', mensagemUsuario: 'u', maxTokens: 10, timeoutMs: 1000 })).rejects.toMatchObject({
      tipo: 'credencial_ausente',
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('classifica 401 como credencial_invalida (nunca retryable no mesmo provider)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-teste'
    process.env.ANTHROPIC_MODEL = 'modelo-teste'
    global.fetch.mockResolvedValueOnce({ ok: false, status: 401 })
    const erro = await AnthropicProvider.gerar({ sistemaPrompt: 's', mensagemUsuario: 'u', maxTokens: 10, timeoutMs: 1000 }).catch((e) => e)
    expect(erro).toBeInstanceOf(ProviderError)
    expect(erro.tipo).toBe('credencial_invalida')
    expect(erro.retryable).toBe(false)
  })

  it('classifica 429 como limite (retryable)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-teste'
    process.env.ANTHROPIC_MODEL = 'modelo-teste'
    global.fetch.mockResolvedValueOnce({ ok: false, status: 429 })
    const erro = await AnthropicProvider.gerar({ sistemaPrompt: 's', mensagemUsuario: 'u', maxTokens: 10, timeoutMs: 1000 }).catch((e) => e)
    expect(erro.tipo).toBe('limite')
    expect(erro.retryable).toBe(true)
  })

  it('classifica 503 como indisponivel (retryable)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-teste'
    process.env.ANTHROPIC_MODEL = 'modelo-teste'
    global.fetch.mockResolvedValueOnce({ ok: false, status: 503 })
    const erro = await AnthropicProvider.gerar({ sistemaPrompt: 's', mensagemUsuario: 'u', maxTokens: 10, timeoutMs: 1000 }).catch((e) => e)
    expect(erro.tipo).toBe('indisponivel')
  })

  it('erro de rede/timeout vira indisponivel, nunca expõe a API key na mensagem', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-SEGREDO-123'
    process.env.ANTHROPIC_MODEL = 'modelo-teste'
    global.fetch.mockRejectedValueOnce(new Error('fetch failed'))
    const erro = await AnthropicProvider.gerar({ sistemaPrompt: 's', mensagemUsuario: 'u', maxTokens: 10, timeoutMs: 1000 }).catch((e) => e)
    expect(erro.tipo).toBe('indisponivel')
    expect(erro.message).not.toContain('SEGREDO')
  })

  it('resposta sem bloco de texto vira resposta_invalida', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-teste'
    process.env.ANTHROPIC_MODEL = 'modelo-teste'
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ content: [] }) })
    const erro = await AnthropicProvider.gerar({ sistemaPrompt: 's', mensagemUsuario: 'u', maxTokens: 10, timeoutMs: 1000 }).catch((e) => e)
    expect(erro.tipo).toBe('resposta_invalida')
  })

  it('sucesso devolve texto/tokens/model corretos', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-teste'
    process.env.ANTHROPIC_MODEL = 'modelo-teste'
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: '{"ok":true}' }], usage: { input_tokens: 10, output_tokens: 5 } }),
    })
    const resp = await AnthropicProvider.gerar({ sistemaPrompt: 's', mensagemUsuario: 'u', maxTokens: 10, timeoutMs: 1000 })
    expect(resp.texto).toBe('{"ok":true}')
    expect(resp.provider).toBe('anthropic')
    expect(resp.model).toBe('modelo-teste')
    expect(resp.tokensEntrada).toBe(10)
    expect(resp.tokensSaida).toBe(5)
  })
})

describe('OpenAIProvider', () => {
  beforeEach(() => {
    limparEnvIA()
    global.fetch = vi.fn()
  })
  afterEach(() => {
    process.env = { ...ENV_ORIGINAL }
    vi.restoreAllMocks()
  })

  it('configurado() é false sem OPENAI_API_KEY/OPENAI_MODEL', () => {
    expect(OpenAIProvider.configurado()).toBe(false)
  })

  it('sucesso devolve texto a partir de choices[0].message.content', async () => {
    process.env.OPENAI_API_KEY = 'sk-teste'
    process.env.OPENAI_MODEL = 'modelo-teste'
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 7, completion_tokens: 3 } }),
    })
    const resp = await OpenAIProvider.gerar({ sistemaPrompt: 's', mensagemUsuario: 'u', maxTokens: 10, timeoutMs: 1000 })
    expect(resp.texto).toBe('{"ok":true}')
    expect(resp.tokensEntrada).toBe(7)
    expect(resp.provider).toBe('openai')
  })

  it('429 classifica como limite', async () => {
    process.env.OPENAI_API_KEY = 'sk-teste'
    process.env.OPENAI_MODEL = 'modelo-teste'
    global.fetch.mockResolvedValueOnce({ ok: false, status: 429 })
    const erro = await OpenAIProvider.gerar({ sistemaPrompt: 's', mensagemUsuario: 'u', maxTokens: 10, timeoutMs: 1000 }).catch((e) => e)
    expect(erro.tipo).toBe('limite')
  })
})
