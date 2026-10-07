// DiscoveryService — orquestra Provider → Normalizer → Deduplicator.
// Roda SÓ do lado do servidor (importado por api/radar-buscar.js). O
// frontend nunca importa este arquivo nem conhece o provider por trás.
//
//   DiscoveryService
//        ↓
//   DiscoveryProvider (buscar)
//        ↓
//   Normalizer (normalizar)
//        ↓
//   Deduplicator (deduplicar)
//        ↓
//   resultado normalizado + marcado

import { buscar as buscarNoProvider } from './providers/GoogleMapsScraperProvider'
import { normalizar, calcularCobertura } from './Normalizer'
import { deduplicar } from './Deduplicator'

/**
 * @param {{segmento: string, localizacao: string, quantidade: number}} parametros
 */
export async function executarBusca({ segmento, localizacao, quantidade }) {
  const inicioTotal = Date.now()
  const query = `${segmento} in ${localizacao}`

  const resultadoProvider = await buscarNoProvider({ segmento, localizacao, quantidade })

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
      duracaoMs: Date.now() - inicioTotal,
    }
  }

  const normalizados = normalizar(resultadoProvider.registros, resultadoProvider.queryUsada || query)
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
    duracaoMs: Date.now() - inicioTotal,
  }
}
