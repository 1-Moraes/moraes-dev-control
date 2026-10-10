import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ENV_ORIGINAL = { ...process.env }

function limparEnvIA() {
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_MODEL
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_MODEL
  delete process.env.GROQ_API_KEY
  delete process.env.GROQ_MODEL
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL
  delete process.env.AI_PRIMARY_PROVIDER
  delete process.env.AI_FALLBACK_PROVIDER
}

describe('AIOrchestrator / seleção de provedor principal e fallback (prioridade custo zero: Groq → Gemini)', () => {
  beforeEach(() => {
    limparEnvIA()
    vi.resetModules()
    global.fetch = vi.fn()
  })
  afterEach(() => {
    process.env = { ...ENV_ORIGINAL }
    vi.restoreAllMocks()
  })

  it('statusProviders() reporta nenhum configurado quando nenhuma env var de IA existe', async () => {
    const { statusProviders } = await import('../AIOrchestrator.js')
    const status = statusProviders()
    expect(status.algumConfigurado).toBe(false)
    expect(status.providers.every((p) => !p.configurado)).toBe(true)
  })

  it('statusProviders() por padrão só avalia groq/gemini, nunca anthropic/openai', async () => {
    const { statusProviders } = await import('../AIOrchestrator.js')
    const nomes = statusProviders().providers.map((p) => p.nome)
    expect(nomes).toEqual(['groq', 'gemini'])
  })

  it('executar() lança credencial_ausente quando nenhum provider está configurado (nunca chama fetch)', async () => {
    const { executar } = await import('../AIOrchestrator.js')
    await expect(executar({ sistemaPrompt: 's', mensagemUsuario: 'u' })).rejects.toMatchObject({ tipo: 'credencial_ausente' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('usa Groq como principal por padrão quando só ele está configurado', async () => {
    process.env.GROQ_API_KEY = 'gsk-a'
    process.env.GROQ_MODEL = 'llama-3.1-8b-instant'
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok-groq' } }], usage: {} }) })
    const { executar } = await import('../AIOrchestrator.js')
    const resp = await executar({ sistemaPrompt: 's', mensagemUsuario: 'u' })
    expect(resp.provider).toBe('groq')
    expect(resp.texto).toBe('ok-groq')
  })

  it('se apenas Gemini estiver configurada, o sistema funciona só com Gemini', async () => {
    process.env.GEMINI_API_KEY = 'gem-a'
    process.env.GEMINI_MODEL = 'gemini-2.5-flash'
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok-gemini' }] } }] }) })
    const { executar } = await import('../AIOrchestrator.js')
    const resp = await executar({ sistemaPrompt: 's', mensagemUsuario: 'u' })
    expect(resp.provider).toBe('gemini')
  })

  it('faz fallback para Gemini quando Groq responde 429 (limite/cota gratuita esgotada, retryable)', async () => {
    process.env.GROQ_API_KEY = 'gsk-a'
    process.env.GROQ_MODEL = 'llama-3.1-8b-instant'
    process.env.GEMINI_API_KEY = 'gem-a'
    process.env.GEMINI_MODEL = 'gemini-2.5-flash'
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 429 }) // Groq
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok-gemini-fallback' }] } }] }) })
    const { executar } = await import('../AIOrchestrator.js')
    const resp = await executar({ sistemaPrompt: 's', mensagemUsuario: 'u' })
    expect(resp.provider).toBe('gemini')
    expect(resp.tentativas).toEqual([
      { provider: 'groq', sucesso: false, tipoErro: 'limite' },
      { provider: 'gemini', sucesso: true },
    ])
  })

  it('NÃO faz fallback em erro não-retryable (credencial inválida) — propaga sem tentar o 2º provider', async () => {
    process.env.GROQ_API_KEY = 'gsk-a'
    process.env.GROQ_MODEL = 'llama-3.1-8b-instant'
    process.env.GEMINI_API_KEY = 'gem-a'
    process.env.GEMINI_MODEL = 'gemini-2.5-flash'
    global.fetch.mockResolvedValueOnce({ ok: false, status: 401 }) // credencial_invalida — não retryable, não tenta o outro
    const { executar } = await import('../AIOrchestrator.js')
    await expect(executar({ sistemaPrompt: 's', mensagemUsuario: 'u' })).rejects.toMatchObject({ tipo: 'credencial_invalida' })
    expect(global.fetch).toHaveBeenCalledTimes(1) // nunca tentou o segundo provider
  })

  it('quando ambos os providers gratuitos falham (ex.: as duas cotas esgotadas), propaga o erro do último com o histórico de tentativas', async () => {
    process.env.GROQ_API_KEY = 'gsk-a'
    process.env.GROQ_MODEL = 'llama-3.1-8b-instant'
    process.env.GEMINI_API_KEY = 'gem-a'
    process.env.GEMINI_MODEL = 'gemini-2.5-flash'
    global.fetch.mockResolvedValueOnce({ ok: false, status: 429 }).mockResolvedValueOnce({ ok: false, status: 429 })
    const { executar } = await import('../AIOrchestrator.js')
    const erro = await executar({ sistemaPrompt: 's', mensagemUsuario: 'u' }).catch((e) => e)
    expect(erro.tipo).toBe('limite')
    expect(erro.tentativas).toHaveLength(2)
  })

  it('Anthropic/OpenAI continuam desativados por padrão: configurá-los sem setar AI_PRIMARY_PROVIDER/AI_FALLBACK_PROVIDER nunca os ativa', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-a'
    process.env.ANTHROPIC_MODEL = 'modelo-a'
    process.env.OPENAI_API_KEY = 'sk-o'
    process.env.OPENAI_MODEL = 'modelo-o'
    // Nenhum GROQ/GEMINI configurado, e nenhuma env var de ordem setada —
    // mesmo com Anthropic/OpenAI prontos, a ordem padrão continua
    // groq/gemini, e como nenhum dos dois está configurado, o resultado
    // tem que ser credencial_ausente, nunca uma chamada à Anthropic/OpenAI.
    const { executar, statusProviders } = await import('../AIOrchestrator.js')
    expect(statusProviders().providers.map((p) => p.nome)).toEqual(['groq', 'gemini'])
    await expect(executar({ sistemaPrompt: 's', mensagemUsuario: 'u' })).rejects.toMatchObject({ tipo: 'credencial_ausente' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('AI_PRIMARY_PROVIDER/AI_FALLBACK_PROVIDER permitem reativar Anthropic/OpenAI explicitamente (decisão humana deliberada)', async () => {
    process.env.AI_PRIMARY_PROVIDER = 'openai'
    process.env.AI_FALLBACK_PROVIDER = 'anthropic'
    process.env.OPENAI_API_KEY = 'sk-o'
    process.env.OPENAI_MODEL = 'modelo-o'
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok' } }], usage: {} }) })
    const { executar } = await import('../AIOrchestrator.js')
    const resp = await executar({ sistemaPrompt: 's', mensagemUsuario: 'u' })
    expect(resp.provider).toBe('openai')
  })
})
