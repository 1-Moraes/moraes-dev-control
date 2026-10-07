import { describe, it, expect } from 'vitest'
import { classificarPresencaDigital } from '../WebsiteAnalyzer'

describe('WebsiteAnalyzer / classificarPresencaDigital', () => {
  it('classifica domínio próprio (não catalogado) como site_proprio_identificado', () => {
    const r = classificarPresencaDigital({ website: 'https://www.barbeariadojoao.com.br' })
    expect(r.categoria).toBe('site_proprio_identificado')
    expect(r.websiteSourceType).toBe('own_domain')
  })

  it('classifica Instagram como rede_social_identificada, nunca como site próprio', () => {
    const r = classificarPresencaDigital({ website: 'https://www.instagram.com/barbearia.exemplo' })
    expect(r.categoria).toBe('rede_social_identificada')
    expect(r.detalhe).toBe('instagram')
    expect(r.websiteSourceType).toBe('social_media')
  })

  it('classifica Facebook como rede_social_identificada', () => {
    const r = classificarPresencaDigital({ website: 'https://www.facebook.com/barbearia.exemplo' })
    expect(r.categoria).toBe('rede_social_identificada')
    expect(r.detalhe).toBe('facebook')
  })

  it('classifica plataforma de agendamento conhecida (ex.: Booksy) como plataforma_externa_identificada', () => {
    const r = classificarPresencaDigital({ website: 'https://booksy.com/pt-br/123_barbearia' })
    expect(r.categoria).toBe('plataforma_externa_identificada')
    expect(r.websiteSourceType).toBe('third_party_platform')
  })

  it('classifica marketplace conhecido (ex.: iFood) como plataforma_externa_identificada', () => {
    const r = classificarPresencaDigital({ website: 'https://www.ifood.com.br/delivery/restaurante-exemplo' })
    expect(r.categoria).toBe('plataforma_externa_identificada')
  })

  it('sem website e sem redes sociais retorna presenca_indefinida (nunca "não tem")', () => {
    const r = classificarPresencaDigital({ website: null })
    expect(r.categoria).toBe('presenca_indefinida')
    expect(r.websiteSourceType).toBe('not_returned')
  })

  it('link manual de Instagram sem website retorna rede_social_identificada', () => {
    const r = classificarPresencaDigital({ website: null, instagramUrlManual: 'https://instagram.com/negocio' })
    expect(r.categoria).toBe('rede_social_identificada')
    expect(r.detalhe).toBe('instagram')
  })

  it('confirmação manual de ausência SEMPRE vence, mesmo com website automático presente', () => {
    const r = classificarPresencaDigital({
      website: 'https://www.sitequalquer.com.br',
      confirmacaoManual: 'confirmado_nao_tem',
    })
    expect(r.categoria).toBe('ausencia_confirmada')
  })

  it('confirmação manual de existência com URL própria classifica pelo domínio informado', () => {
    const r = classificarPresencaDigital({
      website: null,
      siteUrlManual: 'https://www.negociomanual.com.br',
      confirmacaoManual: 'confirmado_tem',
    })
    expect(r.categoria).toBe('site_proprio_identificado')
  })

  it('confirmação manual de existência sem nenhuma URL nunca inventa um domínio', () => {
    const r = classificarPresencaDigital({ confirmacaoManual: 'confirmado_tem' })
    expect(r.categoria).toBe('site_proprio_identificado')
    expect(r.detalhe).toBe('confirmado_sem_url')
  })

  it('nunca retorna ausencia_confirmada automaticamente, por mais forte que seja a ausência de evidência', () => {
    const r = classificarPresencaDigital({ website: null, confirmacaoManual: 'nao_confirmado' })
    expect(r.categoria).not.toBe('ausencia_confirmada')
  })

  it('registra evidências com origem correta (automática vs. manual)', () => {
    const r = classificarPresencaDigital({
      website: 'https://www.sitequalquer.com.br',
      instagramUrlManual: 'https://instagram.com/negocio',
    })
    const porTipo = Object.fromEntries(r.evidencias.map((e) => [e.tipo, e]))
    expect(porTipo.website_fonte.origem).toBe('fonte_automatica')
    expect(porTipo.instagram_manual.origem).toBe('manual')
  })
})
