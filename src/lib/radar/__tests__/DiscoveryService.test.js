import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Testa a seleção de provider via DISCOVERY_PROVIDER (item do ajuste da Fase
// 3A) — garante que a troca é só de PROVIDER, nunca de cidade, e que o
// padrão de produção é o dinâmico (openstreetmap), nunca o catálogo fixo.

describe('DiscoveryService / seleção de provider', () => {
  const originalEnv = process.env.DISCOVERY_PROVIDER

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env.DISCOVERY_PROVIDER = originalEnv
  })

  it('usa FixtureDiscoveryProvider (sem_cobertura) para combinação fora do catálogo quando DISCOVERY_PROVIDER=fixture', async () => {
    process.env.DISCOVERY_PROVIDER = 'fixture'
    const { executarBusca } = await import('../DiscoveryService.js')
    const resultado = await executarBusca({ segmento: 'barbearia', localizacao: 'Itapevi, SP', quantidade: 10 })
    expect(resultado.provider).toBe('fixture_dev')
    expect(resultado.status).toBe('sem_cobertura')
  })

  it('usa FixtureDiscoveryProvider com sucesso para a combinação que está no catálogo (Cotia/barbearia)', async () => {
    process.env.DISCOVERY_PROVIDER = 'fixture'
    const { executarBusca } = await import('../DiscoveryService.js')
    const resultado = await executarBusca({ segmento: 'barbearia', localizacao: 'Cotia, SP', quantidade: 10 })
    expect(resultado.provider).toBe('fixture_dev')
    expect(resultado.status).toBe('ok')
    expect(resultado.resultados.length).toBeGreaterThan(0)
  })

  it('o padrão (sem DISCOVERY_PROVIDER definido) é o provider dinâmico openstreetmap, nunca o catálogo fixo', async () => {
    delete process.env.DISCOVERY_PROVIDER
    const { executarBusca } = await import('../DiscoveryService.js')
    // Mocka fetch pra não depender de rede real neste teste unitário —
    // só queremos confirmar QUAL provider foi escolhido.
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)
    const resultado = await executarBusca({ segmento: 'barbearia', localizacao: 'Cotia, SP', quantidade: 10 })
    expect(resultado.provider).toBe('openstreetmap')
    vi.unstubAllGlobals()
  })

  it('valor desconhecido em DISCOVERY_PROVIDER cai no padrão (openstreetmap), nunca lança nem usa fixture silenciosamente', async () => {
    process.env.DISCOVERY_PROVIDER = 'algo-que-nao-existe'
    const { executarBusca } = await import('../DiscoveryService.js')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)
    const resultado = await executarBusca({ segmento: 'barbearia', localizacao: 'Cotia, SP', quantidade: 10 })
    expect(resultado.provider).toBe('openstreetmap')
    vi.unstubAllGlobals()
  })

  it('o campo source do lead reflete o provider real usado, nunca um valor hardcoded de outro provider', async () => {
    process.env.DISCOVERY_PROVIDER = 'fixture'
    const { executarBusca } = await import('../DiscoveryService.js')
    const resultado = await executarBusca({ segmento: 'barbearia', localizacao: 'Cotia, SP', quantidade: 10 })
    expect(resultado.resultados[0].source).toBe('fixture_dev')
  })

  it('metadados de diagnóstico (queryExecutada/localizacaoExecutada) vêm preenchidos mesmo em falha', async () => {
    process.env.DISCOVERY_PROVIDER = 'fixture'
    const { executarBusca } = await import('../DiscoveryService.js')
    const resultado = await executarBusca({ segmento: 'academia', localizacao: 'Osasco, SP', quantidade: 10 })
    expect(resultado.status).toBe('sem_cobertura')
    expect(resultado.metadados.localizacaoExecutada).toBe('Osasco, SP')
    expect(resultado.metadados.queryExecutada).toContain('academia')
  })
})
