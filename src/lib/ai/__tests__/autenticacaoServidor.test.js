import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extrairBearerToken, verificarLimiteUso } from '../autenticacaoServidor'

describe('autenticacaoServidor / extrairBearerToken', () => {
  it('extrai o token de um header Authorization: Bearer', () => {
    expect(extrairBearerToken({ authorization: 'Bearer abc.def.ghi' })).toBe('abc.def.ghi')
  })

  it('aceita o header com capitalização "Authorization"', () => {
    expect(extrairBearerToken({ Authorization: 'Bearer xyz' })).toBe('xyz')
  })

  it('devolve null sem header, sem prefixo Bearer, ou com header vazio', () => {
    expect(extrairBearerToken({})).toBeNull()
    expect(extrairBearerToken({ authorization: 'Basic abc' })).toBeNull()
    expect(extrairBearerToken(undefined)).toBeNull()
  })
})

describe('autenticacaoServidor / verificarLimiteUso', () => {
  it('permite quando a contagem está abaixo do limite', async () => {
    const clienteFalso = {
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: async () => ({ count: 5, error: null }),
          }),
        }),
      }),
    }
    const r = await verificarLimiteUso(clienteFalso, 'user-1', 30)
    expect(r.dentroDoLimite).toBe(true)
    expect(r.usoAtual).toBe(5)
  })

  it('bloqueia quando a contagem atingiu o limite', async () => {
    const clienteFalso = {
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: async () => ({ count: 30, error: null }),
          }),
        }),
      }),
    }
    const r = await verificarLimiteUso(clienteFalso, 'user-1', 30)
    expect(r.dentroDoLimite).toBe(false)
  })

  it('em erro de contagem, nunca derruba a feature — permite com uso 0 e loga o erro (fail-open documentado)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const clienteFalso = {
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: async () => ({ count: null, error: new Error('timeout') }),
          }),
        }),
      }),
    }
    const r = await verificarLimiteUso(clienteFalso, 'user-1', 30)
    expect(r.dentroDoLimite).toBe(true)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('autenticacaoServidor / autenticarEAutorizar', () => {
  const ENV_ORIGINAL = { ...process.env }
  beforeEach(() => {
    delete process.env.SUPABASE_URL
    delete process.env.VITE_SUPABASE_URL
    delete process.env.SUPABASE_ANON_KEY
    delete process.env.VITE_SUPABASE_ANON_KEY
  })
  afterEach(() => {
    process.env = { ...ENV_ORIGINAL }
  })

  it('retorna nao_configurado quando faltam as env vars do Supabase', async () => {
    const { autenticarEAutorizar } = await import('../autenticacaoServidor')
    const r = await autenticarEAutorizar('algum-token')
    expect(r.autorizado).toBe(false)
    expect(r.motivo).toBe('nao_configurado')
  })

  it('retorna token_ausente quando nenhum token foi passado, mesmo configurado', async () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon-key'
    const { autenticarEAutorizar } = await import('../autenticacaoServidor')
    const r = await autenticarEAutorizar(null)
    expect(r.motivo).toBe('token_ausente')
  })
})
