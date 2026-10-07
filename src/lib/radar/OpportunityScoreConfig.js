// Configuração centralizada do Opportunity Score — Fase 3A.
//
// Pesos, faixas e limiares vivem TODOS neste arquivo (nunca espalhados pelos
// componentes de cálculo em OpportunityScore.js), versionados via
// `SCORE_VERSION` — qualquer ajuste futuro nos critérios muda essa string,
// pra que análises já persistidas em `lead_analysis` continuem rastreáveis
// à versão de regras com que foram calculadas, em vez de parecerem
// inconsistentes silenciosamente.
//
// Regra de ouro do Radar inteiro, mantida aqui: determinístico, sem IA, sem
// aleatoriedade, sem chamada de rede. Mesma entrada + mesma versão desta
// config = mesmo score, sempre.

export const SCORE_VERSION = '1.0'

export const OpportunityScoreConfig = {
  version: SCORE_VERSION,

  // Componente A — Necessidade de Website (até 40 pts). Só 3 níveis,
  // deliberadamente: distinguir "rede social" de "plataforma externa" AQUI
  // duplicaria a contagem do mesmo sinal que o Componente C (Presença
  // Digital) já pontua. "Não identificado automaticamente" sempre pontua
  // MENOS que "confirmado que não tem" (30 < 40) — confirmação humana vale
  // mais que ausência de evidência automática.
  necessidadeWebsite: {
    pesoMaximo: 40,
    confirmadoNaoTem: 40,
    naoIdentificadoAutomaticamente: 30,
    siteProprioIdentificado: 0,
  },

  // Componente B — Qualificação/Demanda (até 30 pts). Quantidade de
  // avaliações é usada como PROXY de demanda/movimento do negócio — nunca
  // como prova de faturamento/receita (item explícito do planejamento,
  // reforçado também na nomenclatura do Dashboard na Fase 2F).
  qualificacaoDemanda: {
    pesoMaximo: 30,
    faixasAvaliacoes: [
      { min: 0, max: 0, pontos: 0 },
      { min: 1, max: 10, pontos: 5 },
      { min: 11, max: 30, pontos: 10 },
      { min: 31, max: 80, pontos: 15 },
      { min: 81, max: Infinity, pontos: 20 },
    ],
    // Bônus por nota média — só soma se já existe pelo menos 1 avaliação
    // (nota isolada, sem nenhuma avaliação, não é sinal confiável).
    faixasNota: [
      { min: 4.5, max: 5.01, pontos: 10 },
      { min: 4.0, max: 4.5, pontos: 7 },
      { min: 3.5, max: 4.0, pontos: 4 },
      { min: 3.0, max: 3.5, pontos: 2 },
      { min: 0, max: 3.0, pontos: 0 },
    ],
  },

  // Componente C — Presença Digital/Maturidade (até 15 pts). Presença em
  // rede social ou plataforma soma pontos moderados — nunca o suficiente,
  // isolada, para parecer "oportunidade forte" (isso depende também dos
  // Componentes A e B).
  presencaDigital: {
    pesoMaximo: 15,
    siteProprio: 5,
    redeSocial: 8,
    plataformaExterna: 6,
    nenhuma: 0,
  },

  // Componente D — Contatabilidade (até 15 pts).
  contatabilidade: {
    pesoMaximo: 15,
    telefone: 6,
    whatsappPossivel: 3,
    endereco: 3,
    dadosCompletos: 3, // nome + categoria + cidade, todos presentes
  },

  // Limiares de classificação — centralizados aqui, nunca hardcoded na UI.
  classificacao: [
    { min: 80, max: 100, label: 'Oportunidade muito forte', cor: 'verde' },
    { min: 60, max: 79, label: 'Boa oportunidade', cor: 'azul' },
    { min: 40, max: 59, label: 'Oportunidade moderada', cor: 'amber' },
    { min: 0, max: 39, label: 'Prioridade menor', cor: 'neutro' },
  ],
}

export function classificarScore(score) {
  const faixa = OpportunityScoreConfig.classificacao.find((f) => score >= f.min && score <= f.max)
  return faixa || OpportunityScoreConfig.classificacao[OpportunityScoreConfig.classificacao.length - 1]
}
