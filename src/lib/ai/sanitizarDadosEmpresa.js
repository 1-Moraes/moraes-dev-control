// sanitizarDadosEmpresa — minimização de dados (Fase 3B, itens 11 e 31 do
// planejamento). Função pura: recebe o lead/candidato do Radar OU do CRM
// (mesmo shape mínimo usado por OpportunityScore.js) + a análise
// determinística já calculada, e devolve SÓ os campos permitidos a serem
// enviados à IA — nenhuma senha, token, nota interna, dado de outro
// cliente ou campo não listado aqui passa por esta função sem querer,
// porque ela constrói o objeto de saída campo a campo (nunca um spread do
// objeto de entrada).
//
// Roda server-side (chamada por AIOrchestrator.js a partir de
// api/ia-radar.js), mas é pura/sem I/O — por isso pode ser testada sem
// mocks de rede ou de Supabase.

/**
 * @param {Object} lead - shape mínimo: name/category/city/state/phone/website/rating/reviewCount
 * @param {Object} analise - resultado de calcularOpportunityScore() (ver OpportunityScore.js)
 * @returns {{empresa: Object, opportunity_score: Object, evidencias: Array}}
 */
export function sanitizarDadosEmpresa(lead, analise) {
  const presenca = analise?.presenca || {}

  const empresa = {
    nome: lead?.name || lead?.nome_empresa || null,
    segmento: lead?.category || lead?.categoria || null,
    cidade: lead?.city || lead?.cidade || null,
    estado: lead?.state || lead?.estado || null,
    telefone_disponivel: Boolean(lead?.phone || lead?.telefone),
    presenca_digital: {
      categoria: presenca.categoria || null,
      detalhe: presenca.detalhe || null,
      confirmacao: presenca.confirmacao || 'nao_confirmado',
    },
    avaliacao: typeof lead?.rating === 'number' ? lead.rating : lead?.rating != null ? Number(lead.rating) : null,
    total_avaliacoes: lead?.reviewCount ?? lead?.quantidade_avaliacoes ?? null,
  }

  const opportunity_score = analise
    ? {
        valor: analise.score,
        versao: analise.scoreVersion,
        classificacao: analise.classificacao,
        criterios: (analise.criterios || []).map((c) => ({ componente: c.componente, pontos: c.pontos, max: c.max, label: c.label })),
      }
    : null

  const evidencias = (presenca.evidencias || []).map((ev) => ({ tipo: ev.tipo, origem: ev.origem, confianca: ev.confianca }))
  // Nunca envia o valor bruto da evidência (pode ser uma URL pessoal/
  // identificável sem necessidade) — só o tipo/origem/confiança, que é o
  // que a análise comercial realmente precisa para raciocinar.

  return { empresa, opportunity_score, evidencias }
}
