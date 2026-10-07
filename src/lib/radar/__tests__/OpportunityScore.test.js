import { describe, it, expect } from 'vitest'
import { calcularOpportunityScore } from '../OpportunityScore'
import { OpportunityScoreConfig } from '../OpportunityScoreConfig'

describe('OpportunityScore / calcularOpportunityScore', () => {
  it('é determinístico: mesma entrada produz sempre o mesmo score e os mesmos critérios', () => {
    const lead = {
      website: null,
      reviewCount: 45,
      rating: 4.6,
      phone: '11999990000',
      address: 'Rua Exemplo, 123',
      name: 'Barbearia Exemplo',
      category: 'Barbearia',
      city: 'Cotia',
    }
    const r1 = calcularOpportunityScore(lead)
    const r2 = calcularOpportunityScore(lead)
    expect(r1.score).toBe(r2.score)
    expect(r1.criterios).toEqual(r2.criterios)
  })

  it('site próprio identificado zera o componente de necessidade de website (0 pts, não apenas baixo)', () => {
    const lead = { website: 'https://www.sitequalquer.com.br', reviewCount: 0, rating: null, phone: null, address: null, name: 'X', category: 'Y', city: 'Z' }
    const r = calcularOpportunityScore(lead)
    const comp = r.criterios.find((c) => c.componente === 'Necessidade de website')
    expect(comp.pontos).toBe(0)
  })

  it('"não identificado automaticamente" pontua MENOS que "confirmado que não tem" (30 < 40)', () => {
    const base = { reviewCount: 0, rating: null, phone: null, address: null, name: null, category: null, city: null }
    const naoIdentificado = calcularOpportunityScore({ ...base, website: null, confirmacaoManual: 'nao_confirmado' })
    const confirmadoAusente = calcularOpportunityScore({ ...base, website: null, confirmacaoManual: 'confirmado_nao_tem' })
    const compA = (r) => r.criterios.find((c) => c.componente === 'Necessidade de website').pontos
    expect(compA(naoIdentificado)).toBe(OpportunityScoreConfig.necessidadeWebsite.naoIdentificadoAutomaticamente)
    expect(compA(confirmadoAusente)).toBe(OpportunityScoreConfig.necessidadeWebsite.confirmadoNaoTem)
    expect(compA(confirmadoAusente)).toBeGreaterThan(compA(naoIdentificado))
  })

  it('nenhum componente soma mais que seu próprio peso máximo (evita dupla contagem)', () => {
    const lead = {
      website: 'https://www.instagram.com/negocio',
      instagramUrlManual: 'https://www.instagram.com/negocio',
      reviewCount: 500,
      rating: 5,
      phone: '11999990000',
      address: 'Rua X',
      name: 'Negócio',
      category: 'Categoria',
      city: 'Cidade',
    }
    const r = calcularOpportunityScore(lead)
    r.criterios.forEach((c) => expect(c.pontos).toBeLessThanOrEqual(c.max))
  })

  it('score final nunca passa de 100 nem fica negativo', () => {
    const r = calcularOpportunityScore({
      website: null,
      confirmacaoManual: 'confirmado_nao_tem',
      reviewCount: 999,
      rating: 5,
      phone: '11999990000',
      address: 'Rua X',
      name: 'Negócio',
      category: 'Categoria',
      city: 'Cidade',
    })
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.score).toBeGreaterThanOrEqual(0)
  })

  it('caso "oportunidade muito forte": ausência confirmada + boa demanda + bem contatável', () => {
    const r = calcularOpportunityScore({
      website: null,
      confirmacaoManual: 'confirmado_nao_tem',
      reviewCount: 90,
      rating: 4.8,
      phone: '11999990000',
      address: 'Rua X, 10',
      name: 'Oficina Exemplo',
      category: 'Oficina Mecânica',
      city: 'Cotia',
    })
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.classificacao).toBe('Oportunidade muito forte')
  })

  it('caso "prioridade menor": site próprio identificado, sem avaliações, sem contato', () => {
    const r = calcularOpportunityScore({
      website: 'https://www.sitecompleto.com.br',
      reviewCount: 0,
      rating: null,
      phone: null,
      address: null,
      name: null,
      category: null,
      city: null,
    })
    expect(r.score).toBeLessThanOrEqual(39)
    expect(r.classificacao).toBe('Prioridade menor')
  })

  it('reviewCount alto sem nenhuma avaliação de nota não aplica bônus de nota', () => {
    const comNota = calcularOpportunityScore({ website: null, reviewCount: 50, rating: 4.9, phone: null, address: null, name: null, category: null, city: null })
    const semNota = calcularOpportunityScore({ website: null, reviewCount: 50, rating: null, phone: null, address: null, name: null, category: null, city: null })
    const pontos = (r) => r.criterios.find((c) => c.componente === 'Qualificação / demanda').pontos
    expect(pontos(comNota)).toBeGreaterThan(pontos(semNota))
  })

  it('categoria nunca é usada como score isolado por segmento (mesmo score para segmentos diferentes com mesmos sinais)', () => {
    const barbearia = calcularOpportunityScore({ website: null, reviewCount: 20, rating: 4.2, phone: '11999990000', address: 'R', name: 'A', category: 'Barbearia', city: 'Cotia' })
    const dentista = calcularOpportunityScore({ website: null, reviewCount: 20, rating: 4.2, phone: '11999990000', address: 'R', name: 'A', category: 'Clínica odontológica', city: 'Cotia' })
    expect(barbearia.score).toBe(dentista.score)
  })

  it('aceita presencaOverride (confirmação manual já calculada pela UI) sem reclassificar a partir do lead', () => {
    const presencaManual = { categoria: 'ausencia_confirmada', detalhe: null, websiteSourceType: 'unknown', evidencias: [], confirmacao: 'confirmado_nao_tem' }
    const r = calcularOpportunityScore({ website: 'https://www.sitequalquer.com.br', reviewCount: 0, rating: null, phone: null, address: null, name: null, category: null, city: null }, presencaManual)
    const compA = r.criterios.find((c) => c.componente === 'Necessidade de website').pontos
    expect(compA).toBe(OpportunityScoreConfig.necessidadeWebsite.confirmadoNaoTem)
  })
})
