// DiscoveryService — orquestra Provider → Normalizer → Deduplicator.
// Roda SÓ do lado do servidor (importado por api/radar-buscar.js). O
// frontend nunca importa este arquivo nem conhece o provider por trás.
//
//   DiscoveryService
//        ↓ seleciona o provider via DISCOVERY_PROVIDER (env, server-side)
//   DiscoveryProvider (buscar)
//        ↓
//   Normalizer (normalizar)
//        ↓
//   Deduplicator (deduplicar)
//        ↓
//   resultado normalizado + marcado
//
// Seleção de provider (ajuste da Fase 3A — "busca dinâmica por
// localidade"): padrão é OpenStreetMapProvider (real, dinâmico, sem chave,
// sem custo). DISCOVERY_PROVIDER=fixture força o catálogo fixo
// (FixtureDiscoveryProvider) — usado em desenvolvimento sem rede e em
// testes automatizados determinísticos, NUNCA o padrão de produção. Nenhum
// nome de cidade aparece aqui: a troca é só de PROVIDER, a mesma chamada
// executarBusca({segmento, localizacao, quantidade}) vale para qualquer
// localização, em qualquer provider.
import * as OpenStreetMapProvider from './providers/OpenStreetMapProvider.js'
import * as FixtureDiscoveryProvider from './providers/FixtureDiscoveryProvider.js'
import { normalizar, calcularCobertura } from './Normalizer.js'
import { deduplicar } from './Deduplicator.js'

const PROVIDERS = {
  openstreetmap: OpenStreetMapProvider,
  fixture: FixtureDiscoveryProvider,
}

function selecionarProvider() {
  const nome = (typeof process !== 'undefined' && process.env?.DISCOVERY_PROVIDER) || 'openstreetmap'
  return PROVIDERS[nome] || PROVIDERS.openstreetmap
}

/**
 * @param {{segmento: string, localizacao: string, quantidade: number}} parametros
 */
export async function executarBusca({ segmento, localizacao, quantidade }) {
  const inicioTotal = Date.now()
  const query = `${segmento} in ${localizacao}`
  const provider = selecionarProvider()

  const resultadoProvider = await provider.buscar({ segmento, localizacao, quantidade })

  if (resultadoProvider.status !== 'ok') {
    return {
      status: resultadoProvider.status,
      provider: resultadoProvider.provider,
      mensagemErro: resultadoProvider.mensagemErro || null,
      quantidadeSolicitada: quantidade,
      quantidadeRetornada: 0,
      quantidadeAposNormalizacao: 0,
      resultados: [],
      gruposDuplicados: [],
      cobertura: null,
      // Metadados de diagnóstico (item 15 do ajuste) — nunca exibidos crus
      // ao usuário, só para log/depuração server-side.
      metadados: { queryExecutada: resultadoProvider.queryUsada || query, localizacaoExecutada: localizacao, ...resultadoProvider.metadados },
      duracaoMs: Date.now() - inicioTotal,
    }
  }

  const normalizados = normalizar(resultadoProvider.registros, resultadoProvider.queryUsada || query, resultadoProvider.provider)
  const { leads: leadsDeduplicados, gruposDuplicados } = deduplicar(normalizados)
  // id estável para o frontend (seleção, destaque lista↔mapa) — sourceId
  // quando existe (quase sempre, ver cobertura), senão a posição no array.
  const leads = leadsDeduplicados.map((lead, i) => ({ id: lead.sourceId || `tmp-${i}`, ...lead }))
  const cobertura = calcularCobertura(leads)

  return {
    status: leads.length ? 'ok' : 'sem_resultado',
    provider: resultadoProvider.provider,
    mensagemErro: null,
    quantidadeSolicitada: quantidade,
    quantidadeRetornada: resultadoProvider.registros.length,
    quantidadeAposNormalizacao: leads.length,
    resultados: leads,
    gruposDuplicados,
    cobertura,
    metadados: { queryExecutada: resultadoProvider.queryUsada || query, localizacaoExecutada: localizacao, ...resultadoProvider.metadados },
    duracaoMs: Date.now() - inicioTotal,
  }
}
