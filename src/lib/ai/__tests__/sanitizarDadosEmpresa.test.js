import { describe, it, expect } from 'vitest'
import { sanitizarDadosEmpresa } from '../sanitizarDadosEmpresa'

describe('sanitizarDadosEmpresa', () => {
  it('nunca inclui campos fora da lista permitida (constrói o objeto campo a campo, nunca spread)', () => {
    const lead = {
      name: 'Barbearia Exemplo',
      category: 'Barbearia',
      city: 'Cotia',
      state: 'SP',
      phone: '11999999999',
      senhaInterna: 'nao-deveria-ir', // campo arbitrário que não existe no shape esperado
      observacoesInternasConfidenciais: 'nota sigilosa',
    }
    const { empresa } = sanitizarDadosEmpresa(lead, null)
    expect(JSON.stringify(empresa)).not.toContain('nao-deveria-ir')
    expect(JSON.stringify(empresa)).not.toContain('sigilosa')
    expect(empresa.nome).toBe('Barbearia Exemplo')
    expect(empresa.telefone_disponivel).toBe(true)
  })

  it('nunca infere ausência de site a partir de campo vazio — presenca_digital vem só do que a análise já classificou', () => {
    const { empresa } = sanitizarDadosEmpresa({ name: 'X' }, null)
    expect(empresa.presenca_digital.categoria).toBeNull()
    expect(empresa.presenca_digital.confirmacao).toBe('nao_confirmado')
  })

  it('reflete a análise determinística (score/criterios) sem recalcular nada', () => {
    const analise = {
      score: 84,
      scoreVersion: '1.0',
      classificacao: 'Alta oportunidade',
      presenca: { categoria: 'rede_social_identificada', detalhe: 'instagram', confirmacao: 'nao_confirmado', evidencias: [{ tipo: 'website_fonte', valor: 'https://instagram.com/x', origem: 'fonte_automatica', confianca: 'media' }] },
      criterios: [{ componente: 'Necessidade de website', pontos: 30, max: 30, label: 'teste' }],
    }
    const { opportunity_score, evidencias } = sanitizarDadosEmpresa({ name: 'X' }, analise)
    expect(opportunity_score.valor).toBe(84)
    expect(opportunity_score.versao).toBe('1.0')
    expect(opportunity_score.criterios).toHaveLength(1)
    // evidência nunca leva o valor bruto (pode ser uma URL), só tipo/origem/confiança
    expect(evidencias[0]).toEqual({ tipo: 'website_fonte', origem: 'fonte_automatica', confianca: 'media' })
    expect(JSON.stringify(evidencias)).not.toContain('instagram.com/x')
  })

  it('opportunity_score é null quando nenhuma análise foi passada (nunca inventa um score)', () => {
    const { opportunity_score } = sanitizarDadosEmpresa({ name: 'X' }, null)
    expect(opportunity_score).toBeNull()
  })
})
