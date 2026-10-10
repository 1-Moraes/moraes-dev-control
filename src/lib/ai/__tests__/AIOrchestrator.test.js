import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ENV_ORIGINAL = { ...process.env }

function limparEnvIA() {
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_MODEL
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_MODEL
  delete process.env.AI_PRIMARY_PROVIDER
  delete process.env.AI_FALLBACK_PROVIDER
}

describe('AIOrchestrator / seleção de provedor principal e fallback', () => {
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

  it('executar() lança credencial_ausente quando nenhum provider está configurado (nunca chama fetch)', async () => {
    const { executar } = await import('../AIOrchestrator.js')
    await expect(executar({ sistemaPrompt: 's', mensagemUsuario: 'u' })).rejects.toMatchObject({ tipo: 'credencial_ausente' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('usa Anthropic como principal por padrão quando só ele está configurado', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-a'
    process.env.ANTHROPIC_MODEL = 'modelo-a'
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'ok-anthropic' }], usage: {} }) })
    const { executar } = await import('../AIOrchestrator.js')
    const resp = await executar({ sistemaPrompt: 's', mensagemUsuario: 'u' })
    expect(resp.provider).toBe('anthropic')
    expect(resp.texto).toBe('ok-anthropic')
  })

  it('se apenas OpenAI estiver configurada, o sistema funciona só com OpenAI', async () => {
    process.env.OPENAI_API_KEY = 'sk-o'
    process.env.OPENAI_MODEL = 'modelo-o'
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok-openai' } }], usage: {} }) })
    const { executar } = await import('../AIOrchestrator.js')
    const resp = await executar({ sistemaPrompt: 's', mensagemUsuario: 'u' })
    expect(resp.provider).toBe('openai')
  })

  it('faz fallback para OpenAI quando Anthropic responde 429 (limite, retryable)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-a'
    process.env.ANTHROPIC_MODEL = 'modelo-a'
    process.env.OPENAI_API_KEY = 'sk-o'
    process.env.OPENAI_MODEL = 'modelo-o'
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 429 }) // Anthropic
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok-openai-fallback' } }], usage: {} }) })
    const { executar } = await import('../AIOrchestrator.js')
    const resp = await executar({ sistemaPrompt: 's', mensagemUsuario: 'u' })
    expect(resp.provider).toBe('openai')
    expect(resp.tentativas).toEqual([
      { provider: 'anthropic', sucesso: false, tipoErro: 'limite' },
      { provider: 'openai', sucesso: true },
    ])
  })

  it('NÃO faz fallback em erro de validação da própria requisição — mas valores malformados nunca chegam ao provider (payload é só texto aqui, então este teste cobre erro não-retryable propagando sem tentar o 2º provider)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-a'
    process.env.ANTHROPIC_MODEL = 'modelo-a'
    process.env.OPENAI_API_KEY = 'sk-o'
    process.env.OPENAI_MODEL = 'modelo-o'
    global.fetch.mockResolvedValueOnce({ ok: false, status: 401 }) // credencial_invalida — não retryable, não tenta o outro
    const { executar } = await import('../AIOrchestrator.js')
    await expect(executar({ sistemaPrompt: 's', mensagemUsuario: 'u' })).rejects.toMatchObject({ tipo: 'credencial_invalida' })
    expect(global.fetch).toHaveBeenCalledTimes(1) // nunca tentou o segundo provider
  })

  it('quando ambos falham, propaga o erro do último provider tentado com o histórico de tentativas', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-a'
    process.env.ANTHROPIC_MODEL = 'modelo-a'
    process.env.OPENAI_API_KEY = 'sk-o'
    process.env.OPENAI_MODEL = 'modelo-o'
    global.fetch.mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: false, status: 503 })
    const { executar } = await import('../AIOrchestrator.js')
    const erro = await executar({ sistemaPrompt: 's', mensagemUsuario: 'u' }).catch((e) => e)
    expect(erro.tipo).toBe('indisponivel')
    expect(erro.tentativas).toHaveLength(2)
  })

  it('AI_PRIMARY_PROVIDER/AI_FALLBACK_PROVIDER controlam a ordem', async () => {
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
