// WebsiteAnalyzer / PresenceClassifier — Fase 3A, "Inteligência do Radar".
//
// Classifica a presença digital de um LeadCandidate (Radar) ou de um lead já
// no CRM usando SÓ evidência que a própria fonte (Normalizer) já retornou,
// mais qualquer confirmação manual registrada por um humano. Esta função
// NUNCA faz fetch de URL, NUNCA acessa Instagram/Facebook, NUNCA tenta
// login/scraping, NUNCA usa IA — é classificação determinística de string
// (domínio da URL) + regras explícitas, auditável por qualquer pessoa lendo
// este arquivo.
//
// Categorias (evidência, da mais fraca à mais forte):
//   presenca_indefinida             — sem website, sem rede social conhecida,
//                                      sem confirmação manual. "Não sabemos."
//   rede_social_identificada        — website aponta pra Instagram/Facebook,
//                                      OU link manual de Instagram/Facebook.
//   plataforma_externa_identificada — website aponta pra uma plataforma de
//                                      agendamento/marketplace/agregador de
//                                      links já catalogada (ver abaixo).
//   site_proprio_identificado       — domínio próprio (não catalogado como
//                                      rede social/plataforma), OU confirmado
//                                      manualmente que tem site.
//   ausencia_confirmada              — um humano confirmou explicitamente que
//                                      o negócio NÃO tem site. NUNCA inferido
//                                      automaticamente — só existe via
//                                      `confirmacaoManual === 'confirmado_nao_tem'`.
//
// PRECEDÊNCIA: confirmação manual tem prioridade ABSOLUTA sobre a
// classificação automática. Rodar a análise automática de novo nunca reverte
// silenciosamente uma confirmação humana — por isso este módulo recebe
// `confirmacaoManual` como entrada e decide a partir dela ANTES de olhar pro
// website automático (ver `classificarPresencaDigital` abaixo). Reverter para
// "não confirmado" é uma ação explícita de quem usa a tela, nunca efeito
// colateral de uma nova busca/análise.
//
// Catálogo de domínios: construído a partir de evidência REAL (as 3
// fixtures do modo laboratório do Radar — barbearias-cotia, dentistas-cotia,
// restaurantes-barueri — mais os domínios já usados em Deduplicator.js e
// LeadsService.js para dedup). Não é uma lista genérica da internet, e não
// pretende cobrir toda plataforma existente (item explícito do planejamento:
// "não precisa catalogar a internet inteira"). Casos ambíguos encontrados
// durante a investigação (ex.: um subdomínio que pode ser uma rede de
// franquias, não uma plataforma de terceiros) foram deixados DE FORA do
// catálogo de propósito — melhor classificar como "site próprio" com uma
// limitação documentada do que inventar certeza sobre algo não confirmado.

const REDES_SOCIAIS = new Set(['facebook.com', 'www.facebook.com', 'instagram.com', 'www.instagram.com'])

const PLATAFORMAS_EXTERNAS = new Set([
  // Agregadores de link/bio
  'wa.me',
  'linktr.ee',
  'linktree.com',
  'bio.site',
  'trakto.link',
  'campsite.bio',
  // Plataformas de agendamento/booking
  'booksy.com',
  'trinks.com',
  'meudoutor.com',
  'sites.appbarber.com.br',
  'appbarber.com.br',
  // Marketplace/delivery
  'ifood.com.br',
])

function extrairDominio(url) {
  if (!url) return null
  const m = String(url).match(/https?:\/\/(?:www\.)?([^/]+)/i)
  return m ? m[1].toLowerCase() : null
}

function categoriaPorDominio(dominio) {
  if (!dominio) return null
  if (REDES_SOCIAIS.has(dominio)) {
    return { categoria: 'rede_social_identificada', detalhe: dominio.includes('instagram') ? 'instagram' : 'facebook' }
  }
  if (PLATAFORMAS_EXTERNAS.has(dominio)) {
    return { categoria: 'plataforma_externa_identificada', detalhe: dominio }
  }
  return { categoria: 'site_proprio_identificado', detalhe: 'dominio_proprio' }
}

// Mapeia a categoria interna, mais rica, pro enum já existente na coluna
// leads.website_source_type (criada na Fase 2C, nunca usada até agora) — o
// fato "confirmado que não tem" mora em `website_confirmacao`
// (coluna nova desta fase), não neste campo, que descreve só o TIPO de
// presença digital encontrada, nunca a ausência confirmada dela.
const MAPA_WEBSITE_SOURCE_TYPE = {
  site_proprio_identificado: 'own_domain',
  rede_social_identificada: 'social_media',
  plataforma_externa_identificada: 'third_party_platform',
  presenca_indefinida: 'unknown',
  ausencia_confirmada: 'unknown',
}

/**
 * @typedef {'nao_confirmado'|'confirmado_tem'|'confirmado_nao_tem'} ConfirmacaoManual
 */

/**
 * @param {Object} entrada
 * @param {string|null} [entrada.website] - website retornado pela fonte (Normalizer)
 * @param {string|null} [entrada.instagramUrlManual] - link de Instagram informado manualmente
 * @param {string|null} [entrada.facebookUrlManual] - link de Facebook informado manualmente
 * @param {string|null} [entrada.siteUrlManual] - URL de site informada manualmente
 * @param {ConfirmacaoManual} [entrada.confirmacaoManual]
 * @returns {{
 *   categoria: string,
 *   detalhe: string|null,
 *   websiteSourceType: string,
 *   evidencias: Array<{tipo:string, valor:string, origem:string, confianca:string}>,
 *   confirmacao: ConfirmacaoManual,
 * }}
 */
export function classificarPresencaDigital(entrada) {
  const {
    website = null,
    instagramUrlManual = null,
    facebookUrlManual = null,
    siteUrlManual = null,
    confirmacaoManual = 'nao_confirmado',
  } = entrada || {}

  const evidencias = []
  if (website) evidencias.push({ tipo: 'website_fonte', valor: website, origem: 'fonte_automatica', confianca: 'media' })
  if (instagramUrlManual) evidencias.push({ tipo: 'instagram_manual', valor: instagramUrlManual, origem: 'manual', confianca: 'alta' })
  if (facebookUrlManual) evidencias.push({ tipo: 'facebook_manual', valor: facebookUrlManual, origem: 'manual', confianca: 'alta' })
  if (siteUrlManual) evidencias.push({ tipo: 'site_manual', valor: siteUrlManual, origem: 'manual', confianca: 'alta' })

  // 1) Confirmação manual de AUSÊNCIA — precedência absoluta, nunca
  // recalculada a partir do website automático.
  if (confirmacaoManual === 'confirmado_nao_tem') {
    return {
      categoria: 'ausencia_confirmada',
      detalhe: null,
      websiteSourceType: MAPA_WEBSITE_SOURCE_TYPE.ausencia_confirmada,
      evidencias,
      confirmacao: confirmacaoManual,
    }
  }

  // 2) Confirmação manual de EXISTÊNCIA — também tem precedência; só usamos
  // o automático pra decidir o "detalhe" quando há uma URL manual pra
  // classificar, nunca pra contradizer a confirmação em si.
  if (confirmacaoManual === 'confirmado_tem') {
    const porDominioManual = categoriaPorDominio(extrairDominio(siteUrlManual))
    if (porDominioManual) {
      return {
        categoria: porDominioManual.categoria,
        detalhe: porDominioManual.detalhe,
        websiteSourceType: MAPA_WEBSITE_SOURCE_TYPE[porDominioManual.categoria],
        evidencias,
        confirmacao: confirmacaoManual,
      }
    }
    if (instagramUrlManual || facebookUrlManual) {
      const detalhe = instagramUrlManual ? 'instagram' : 'facebook'
      return { categoria: 'rede_social_identificada', detalhe, websiteSourceType: 'social_media', evidencias, confirmacao: confirmacaoManual }
    }
    // Confirmado que tem, mas sem nenhuma URL registrada ainda — nunca
    // inventamos um domínio; registramos a confirmação como site próprio
    // identificado, com detalhe explícito de que falta o link.
    return {
      categoria: 'site_proprio_identificado',
      detalhe: 'confirmado_sem_url',
      websiteSourceType: 'own_domain',
      evidencias,
      confirmacao: confirmacaoManual,
    }
  }

  // 3) Automático (não confirmado) — NUNCA pode resultar em
  // "ausencia_confirmada": essa categoria só existe por ação humana.
  const porDominio = categoriaPorDominio(extrairDominio(website))
  if (porDominio) {
    return {
      categoria: porDominio.categoria,
      detalhe: porDominio.detalhe,
      websiteSourceType: MAPA_WEBSITE_SOURCE_TYPE[porDominio.categoria],
      evidencias,
      confirmacao: confirmacaoManual,
    }
  }
  if (instagramUrlManual || facebookUrlManual) {
    const detalhe = instagramUrlManual ? 'instagram' : 'facebook'
    return { categoria: 'rede_social_identificada', detalhe, websiteSourceType: 'social_media', evidencias, confirmacao: confirmacaoManual }
  }
  return {
    categoria: 'presenca_indefinida',
    detalhe: null,
    websiteSourceType: website ? 'unknown' : 'not_returned',
    evidencias,
    confirmacao: confirmacaoManual,
  }
}

// Exportado só para os testes unitários inspecionarem o catálogo sem
// duplicar as listas — nunca para uso em lógica de produção fora deste
// arquivo.
export const _catalogoParaTestes = { REDES_SOCIAIS, PLATAFORMAS_EXTERNAS }
