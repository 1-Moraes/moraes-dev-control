import { describe, it, expect, vi, beforeEach } from 'vitest'

// Testa só as garantias da Fase 3B explicitamente exigidas pelo
// planejamento (itens 32 e o critério de aceite "a IA nunca altera o
// Opportunity Score"), mockando o supabaseClient inteiro — este arquivo
// não testa o resto de LeadsService.js (CRUD de leads/notas/atividades),
// que já é exercitado manualmente desde a Fase 2C e está fora do escopo
// desta fase.

const insertMock = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: 'linha-1' }, error: null }) }) }))
const getUserMock = vi.fn(async () => ({ data: { user: { id: 'user-1' } } }))

vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: { getUser: getUserMock },
    from: vi.fn(() => ({ insert: insertMock })),
  },
}))

const { registrarNovaAnalise, salvarAnaliseIA, analiseEstaDesatualizada } = await import('../LeadsService')
const { supabase } = await import('../../supabaseClient')

const ANALISE = { score: 42, scoreVersion: '1.0', criterios: [{ componente: 'c', pontos: 1, max: 2, label: 'l' }], presenca: { categoria: 'x' } }
const RESULTADO_IA = {
  dados: { resumo_comercial: 'resumo', oportunidade_principal: 'oportunidade' },
  provider: 'anthropic',
  model: 'modelo-x',
  promptVersao: '1.0',
}

describe('LeadsService — garantias de IA da Fase 3B', () => {
  beforeEach(() => {
    insertMock.mockClear()
    supabase.from.mockClear()
  })

  it('registrarNovaAnalise sem analiseIA grava só o score determinístico, sem colunas de IA', async () => {
    await registrarNovaAnalise('lead-1', ANALISE)
    const payload = insertMock.mock.calls[0][0]
    expect(payload.score_deterministico).toBe(42)
    expect(payload.score_final).toBe(42)
    expect(payload.interpretacao_ia).toBeUndefined()
    expect(payload.ia_provider).toBeUndefined()
  })

  it('salvarAnaliseIA grava a interpretação de IA SEM alterar score_final em relação ao score determinístico', async () => {
    await salvarAnaliseIA('lead-1', ANALISE, RESULTADO_IA)
    const payload = insertMock.mock.calls[0][0]
    // Critério de aceite explícito da Fase 3B: a IA nunca altera o
    // Opportunity Score — score_final é sempre igual ao determinístico,
    // com ou sem interpretação de IA na mesma linha.
    expect(payload.score_final).toBe(ANALISE.score)
    expect(payload.score_deterministico).toBe(ANALISE.score)
    expect(payload.interpretacao_ia).toBe('resumo')
    expect(payload.interpretacao_estruturada).toEqual(RESULTADO_IA.dados)
    expect(payload.ia_provider).toBe('anthropic')
    expect(payload.ia_model).toBe('modelo-x')
    expect(payload.ia_prompt_versao).toBe('1.0')
  })

  it('salvarAnaliseIA não grava nada quando a IA ainda não produziu dados válidos', async () => {
    await salvarAnaliseIA('lead-1', ANALISE, { provider: 'anthropic' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('analiseEstaDesatualizada: false quando o lead não mudou desde a análise', () => {
    const analiseRow = { created_at: '2026-01-10T12:00:00Z' }
    const lead = { updated_at: '2026-01-10T12:00:00Z' }
    expect(analiseEstaDesatualizada(analiseRow, lead)).toBe(false)
  })

  it('analiseEstaDesatualizada: true quando o lead foi atualizado depois da análise salva', () => {
    const analiseRow = { created_at: '2026-01-10T12:00:00Z' }
    const lead = { updated_at: '2026-01-10T15:00:00Z' }
    expect(analiseEstaDesatualizada(analiseRow, lead)).toBe(true)
  })

  it('analiseEstaDesatualizada: false sem dados suficientes (nunca assume desatualizado por falta de informação)', () => {
    expect(analiseEstaDesatualizada(null, { updated_at: '2026-01-10T15:00:00Z' })).toBe(false)
    expect(analiseEstaDesatualizada({ created_at: '2026-01-10T12:00:00Z' }, null)).toBe(false)
  })
})
