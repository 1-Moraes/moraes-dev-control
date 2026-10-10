// AIService — interface de IA do lado do navegador (Fase 3B — substitui o
// placeholder da fase anterior, que só registrava a forma do contrato sem
// nenhum provider integrado). Roda no bundle Vite: por isso NUNCA importa
// AIOrchestrator.js nem os providers (src/lib/ai/providers/) diretamente —
// toda chamada real acontece em api/ia-radar.js, uma Vercel Function.
// Nenhuma API key de IA existe ou pode existir aqui.
//
// Os componentes de UI (DrawerAnaliseLead.jsx, PainelAnaliseIA.jsx,
// DrawerLead.jsx) chamam só as funções daqui — nunca fazem fetch direto em
// '/api/ia-radar'. `accessToken` é o `session.access_token` do Supabase
// Auth (useAuth(), ver AuthContext.jsx) — a rota exige autenticação (item
// 28 do planejamento).

async function chamarEndpoint(accessToken, payload) {
  const resp = await fetch('/api/ia-radar', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  let dados
  try {
    dados = await resp.json()
  } catch {
    return { status: 'erro', mensagemErro: 'Resposta inesperada do servidor.' }
  }
  return dados
}

/**
 * @param {Object} params
 * @param {string} params.accessToken - sessão Supabase do usuário logado
 * @param {Object} params.empresaCandidata - shape mínimo (ver OpportunityScore.js): name/category/city/state/phone/website/rating/reviewCount + instagramUrlManual/facebookUrlManual/siteUrlManual/confirmacaoManual
 * @param {Object} params.analise - resultado de calcularOpportunityScore() já calculado (nunca recalculado aqui)
 * @param {string|null} [params.leadId] - id em `leads`, quando a empresa já está no CRM; null/undefined para candidato ainda só no Radar
 * @returns {Promise<Object>} ver api/ia-radar.js para o formato completo da resposta
 */
export async function analisarOportunidade({ accessToken, empresaCandidata, analise, leadId }) {
  return chamarEndpoint(accessToken, {
    tarefa: 'analisar_oportunidade',
    leadId: leadId || null,
    empresaCandidata,
    analise,
  })
}

/**
 * @param {Object} params
 * @param {string} params.accessToken
 * @param {Object} params.empresaCandidata
 * @param {Object} params.analise
 * @param {string|null} [params.leadId]
 * @param {string} [params.instrucoesAdicionais] - texto livre opcional do usuário (item 17: "informações opcionais fornecidas pelo usuário")
 */
export async function gerarAbordagem({ accessToken, empresaCandidata, analise, leadId, instrucoesAdicionais }) {
  return chamarEndpoint(accessToken, {
    tarefa: 'gerar_abordagem',
    leadId: leadId || null,
    empresaCandidata,
    analise,
    instrucoesAdicionais: instrucoesAdicionais || null,
  })
}
