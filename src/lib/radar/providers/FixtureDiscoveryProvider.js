// FixtureDiscoveryProvider — implementação de DiscoveryProvider baseada em
// fixtures estáticas (RENOMEADO de GoogleMapsScraperProvider.js no ajuste da
// Fase 3A — "busca dinâmica por localidade").
//
// POR QUE ESTE PROVIDER SÓ COBRE 3 COMBINAÇÕES (a causa raiz do ajuste):
// este provider nunca consultou nada ao vivo — ele é um catálogo fixo de
// TRÊS testes reais já executados na Fase 2A/2A.1 (mesmos arquivos do
// moraes-radar-lab): barbearias em Cotia, dentistas em Cotia, restaurantes
// em Barueri. Qualquer busca fora dessas 3 combinações nunca teve chance de
// funcionar — não é um bug de cache, de normalização nem de UI, é a
// cobertura do próprio provider. Esse é exatamente o diagnóstico pedido no
// ajuste: "Cotia funciona" porque é a localidade coberta pelas fixtures de
// barbearia/dentista; "Itapevi/Barueri/Osasco/São Paulo/Praia Grande" não
// funcionavam porque simplesmente não existe fixture pra elas (Barueri só
// tem fixture de RESTAURANTE, não de barbearia/dentista — por isso nem toda
// combinação "funciona mesmo dentro das 3 cidades testadas").
//
// Desde este ajuste, este provider NUNCA é mais o provider real padrão —
// ele continua existindo só para:
//   - desenvolvimento local sem rede (ex.: sem acesso à internet);
//   - testes automatizados determinísticos (ver __tests__);
//   - demonstração offline;
//   - fallback explícito via DISCOVERY_PROVIDER=fixture (nunca o padrão).
// O provider real/dinâmico agora é OpenStreetMapProvider.js — ver esse
// arquivo e DiscoveryService.js para a seleção entre os dois.
//
// NOTA TÉCNICA (herdada, ainda válida): os datasets são módulos .js com
// `export default [...]`, nunca lidos via fs em runtime — necessário porque
// o bundler de Vercel Functions rastreia só imports estáticos.

import barbeariasCotia from '../../../../api/_radar-lab-fixtures/barbearias-cotia.js'
import dentistasCotia from '../../../../api/_radar-lab-fixtures/dentistas-cotia.js'
import restaurantesBarueri from '../../../../api/_radar-lab-fixtures/restaurantes-barueri.js'

// Catálogo do que foi REALMENTE testado na Fase 2A/2A.1 — ver
// moraes-radar-lab/docs/relatorio-fase-2a.md e relatorio-fase-2a1-validacao.md.
const CATALOGO_TESTADO = [
  {
    registros: barbeariasCotia,
    segmentos: ['barbearia', 'barbearias', 'barber', 'barbeiro'],
    localizacoes: ['cotia'],
    queryOriginal: 'barbearia in Cotia, SP, Brazil',
  },
  {
    registros: dentistasCotia,
    segmentos: ['dentista', 'dentistas', 'odontologia', 'odonto', 'clinica odontologica'],
    localizacoes: ['cotia'],
    queryOriginal: 'dentista in Cotia, SP, Brazil',
  },
  {
    registros: restaurantesBarueri,
    segmentos: ['restaurante', 'restaurantes'],
    localizacoes: ['barueri'],
    queryOriginal: 'restaurante in Barueri, SP, Brazil',
  },
]

function semAcento(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function encontrarFixture(segmento, localizacao) {
  const seg = semAcento(segmento)
  const loc = semAcento(localizacao)
  return CATALOGO_TESTADO.find(
    (item) =>
      item.segmentos.some((s) => seg.includes(s) || s.includes(seg)) &&
      item.localizacoes.some((l) => loc.includes(l))
  )
}

/**
 * @param {import('./DiscoveryProvider').ParametrosBusca} parametros
 * @returns {Promise<import('./DiscoveryProvider').ResultadoBrutoProvider>}
 */
export async function buscar({ segmento, localizacao, quantidade }) {
  const inicio = Date.now()
  const catalogo = encontrarFixture(segmento, localizacao)

  if (!catalogo) {
    // PROVIDER_SEM_COBERTURA (item 14 do ajuste) — diferente de "busca
    // executada, zero resultados": este provider nunca teve chance de
    // procurar essa combinação, porque ela não está no catálogo fixo.
    return {
      registros: [],
      provider: 'fixture_dev',
      status: 'sem_cobertura',
      duracaoMs: Date.now() - inicio,
    }
  }

  const limite = Math.max(1, Math.min(50, Number(quantidade) || 20))
  return {
    registros: catalogo.registros.slice(0, limite),
    provider: 'fixture_dev',
    status: 'ok',
    duracaoMs: Date.now() - inicio,
    queryUsada: catalogo.queryOriginal,
  }
}
