// OpportunityScore — Fase 3A, "Inteligência do Radar".
//
// Função pura e determinística: mesma entrada (+ mesma versão de
// OpportunityScoreConfig) produz sempre a mesma saída. NUNCA chama rede,
// banco de dados ou IA — todo o cálculo é local, em memória, reconstituível
// a qualquer momento a partir dos mesmos dados (por isso cada critério
// devolve um `label` em linguagem humana, pensado pra alimentar
// `lead_analysis.sinais` e o painel "Ver análise" sem precisar da IA
// reservada pra Fase 3B pra explicar como o score chegou naquele valor).
//
// Cada componente mora numa função só sua, isolada, SOMANDO sinais que não
// se repetem entre componentes (evita contar o mesmo dado duas vezes —
// ex.: Instagram conta só no Componente C, nunca também no A).
import { OpportunityScoreConfig, classificarScore } from './OpportunityScoreConfig'
import { classificarPresencaDigital } from './WebsiteAnalyzer'

function pontosNecessidadeWebsite(presenca) {
  const cfg = OpportunityScoreConfig.necessidadeWebsite
  if (presenca.categoria === 'ausencia_confirmada') {
    return { pontos: cfg.confirmadoNaoTem, label: `Ausência de site confirmada manualmente (+${cfg.confirmadoNaoTem})` }
  }
  if (presenca.categoria === 'site_proprio_identificado') {
    return { pontos: cfg.siteProprioIdentificado, label: `Site próprio identificado (+${cfg.siteProprioIdentificado})` }
  }
  return {
    pontos: cfg.naoIdentificadoAutomaticamente,
    label: `Necessidade de site não identificada automaticamente (+${cfg.naoIdentificadoAutomaticamente})`,
  }
}

function pontosQualificacaoDemanda({ reviewCount, rating }) {
  const cfg = OpportunityScoreConfig.qualificacaoDemanda
  const n = Number(reviewCount) || 0
  const faixaN = cfg.faixasAvaliacoes.find((f) => n >= f.min && n <= f.max) || cfg.faixasAvaliacoes[0]
  let pontos = faixaN.pontos
  let labelNota = ''
  if (n > 0 && rating) {
    const nota = Number(rating)
    const faixaR = cfg.faixasNota.find((f) => nota >= f.min && nota < f.max) || cfg.faixasNota[cfg.faixasNota.length - 1]
    pontos += faixaR.pontos
    labelNota = ` + nota ${nota} (+${faixaR.pontos})`
  }
  pontos = Math.min(pontos, cfg.pesoMaximo)
  return { pontos, label: `${n} avaliação(ões) (+${faixaN.pontos})${labelNota}` }
}

function pontosPresencaDigital(presenca) {
  const cfg = OpportunityScoreConfig.presencaDigital
  if (presenca.categoria === 'rede_social_identificada') {
    return { pontos: cfg.redeSocial, label: `Presença em rede social identificada (+${cfg.redeSocial})` }
  }
  if (presenca.categoria === 'plataforma_externa_identificada') {
    return { pontos: cfg.plataformaExterna, label: `Presença em plataforma externa identificada (+${cfg.plataformaExterna})` }
  }
  if (presenca.categoria === 'site_proprio_identificado') {
    return { pontos: cfg.siteProprio, label: `Site próprio como sinal de maturidade digital (+${cfg.siteProprio})` }
  }
  return { pontos: cfg.nenhuma, label: 'Nenhuma presença digital identificada (+0)' }
}

function pontosContatabilidade({ phone, address, name, category, city }) {
  const cfg = OpportunityScoreConfig.contatabilidade
  let pontos = 0
  const partes = []
  if (phone) {
    pontos += cfg.telefone
    partes.push(`telefone (+${cfg.telefone})`)
    pontos += cfg.whatsappPossivel
    partes.push(`WhatsApp possível via telefone (+${cfg.whatsappPossivel})`)
  }
  if (address) {
    pontos += cfg.endereco
    partes.push(`endereço (+${cfg.endereco})`)
  }
  if (name && category && city) {
    pontos += cfg.dadosCompletos
    partes.push(`dados completos (+${cfg.dadosCompletos})`)
  }
  pontos = Math.min(pontos, cfg.pesoMaximo)
  return { pontos, label: partes.length ? partes.join(', ') : 'Nenhum dado de contato disponível (+0)' }
}

/**
 * @param {Object} lead - LeadCandidate do Radar ou lead do CRM (mesmo shape mínimo: website, reviewCount, rating, phone, address, name, category, city)
 * @param {Object} [presencaOverride] - resultado já calculado de classificarPresencaDigital(); usado quando a UI já tem a confirmação manual em mãos e não quer reclassificar a partir de `lead`
 * @returns {{score:number, scoreVersion:string, classificacao:string, classificacaoCor:string, presenca:Object, criterios:Array, calculadoEm:string}}
 */
export function calcularOpportunityScore(lead, presencaOverride = null) {
  const presenca =
    presencaOverride ||
    classificarPresencaDigital({
      website: lead.website,
      instagramUrlManual: lead.instagramUrlManual,
      facebookUrlManual: lead.facebookUrlManual,
      siteUrlManual: lead.siteUrlManual,
      confirmacaoManual: lead.confirmacaoManual,
    })

  const a = pontosNecessidadeWebsite(presenca)
  const b = pontosQualificacaoDemanda(lead)
  const c = pontosPresencaDigital(presenca)
  const d = pontosContatabilidade(lead)

  const score = Math.max(0, Math.min(100, a.pontos + b.pontos + c.pontos + d.pontos))
  const classificacao = classificarScore(score)

  return {
    score,
    scoreVersion: OpportunityScoreConfig.version,
    classificacao: classificacao.label,
    classificacaoCor: classificacao.cor,
    presenca,
    criterios: [
      { componente: 'Necessidade de website', pontos: a.pontos, max: OpportunityScoreConfig.necessidadeWebsite.pesoMaximo, label: a.label },
      { componente: 'Qualificação / demanda', pontos: b.pontos, max: OpportunityScoreConfig.qualificacaoDemanda.pesoMaximo, label: b.label },
      { componente: 'Presença digital / maturidade', pontos: c.pontos, max: OpportunityScoreConfig.presencaDigital.pesoMaximo, label: c.label },
      { componente: 'Contatabilidade', pontos: d.pontos, max: OpportunityScoreConfig.contatabilidade.pesoMaximo, label: d.label },
    ],
    // Metadado informativo (quando o cálculo rodou) — nunca entra no valor
    // do score em si, só documenta o momento; os testes de determinismo
    // comparam `score`/`criterios`, não este campo.
    calculadoEm: new Date().toISOString(),
  }
}
