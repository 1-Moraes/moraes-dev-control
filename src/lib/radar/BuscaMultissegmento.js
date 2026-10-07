// Orquestração de busca multissegmento — Fase 3A, item "busca
// multissegmento". Roda N buscas de segmento único (MESMO endpoint
// /api/radar-buscar já existente — uma chamada por segmento, nunca um
// endpoint novo) com concorrência controlada: nunca dispara todas de uma
// vez (pedido explícito do planejamento).
//
// Falha parcial em um segmento NUNCA descarta os outros — cada resultado
// guarda seu próprio status; quem chama decide como agregar/exibir
// ("4 de 5 buscas concluídas", ver Prospeccao.jsx).
//
// Cancelamento de uma rodada em andamento não é suportado nesta fase
// (documentado como limitação no relatório final, conforme permitido pelo
// próprio planejamento quando não é trivial).

import { CONCORRENCIA_MULTIBUSCA } from './segmentosPreset'

/**
 * @param {string[]} segmentos
 * @param {(segmento:string) => Promise<Object>} executarUmSegmento - já fechado sobre localizacao/quantidade
 * @param {(progresso: {segmento:string, status:string, indice:number, total:number}) => void} [onProgresso]
 * @returns {Promise<Array<{segmento:string, status:'sucesso'|'erro', resultado?:Object, erro?:string}>>}
 */
export async function executarBuscaMultissegmento(segmentos, executarUmSegmento, onProgresso) {
  const total = segmentos.length
  const resultados = new Array(total)
  let proximoIndice = 0

  async function worker() {
    while (proximoIndice < total) {
      const indice = proximoIndice++
      const segmento = segmentos[indice]
      onProgresso?.({ segmento, status: 'em_andamento', indice, total })
      try {
        const resultado = await executarUmSegmento(segmento)
        resultados[indice] = { segmento, status: 'sucesso', resultado }
        onProgresso?.({ segmento, status: 'sucesso', indice, total })
      } catch (erro) {
        resultados[indice] = { segmento, status: 'erro', erro: erro?.message || 'Falha desconhecida' }
        onProgresso?.({ segmento, status: 'erro', indice, total })
      }
    }
  }

  const nWorkers = Math.max(1, Math.min(CONCORRENCIA_MULTIBUSCA, total))
  await Promise.all(Array.from({ length: nWorkers }, () => worker()))
  return resultados
}

/**
 * Unifica os resultados de vários segmentos num único array de
 * LeadCandidate, preservando qual segmento originou cada um
 * (`lead.segmentoOrigem`) — a deduplicação entre segmentos diferentes
 * (ex.: o mesmo salão aparecendo em "Salões de beleza" e em "Clínicas de
 * estética") é responsabilidade de quem chama, reusando Deduplicator.js,
 * nunca um algoritmo novo criado aqui.
 */
export function unificarResultadosMultissegmento(resultadosPorSegmento) {
  const candidatos = []
  for (const r of resultadosPorSegmento) {
    if (r.status !== 'sucesso' || !r.resultado?.resultados?.length) continue
    for (const lead of r.resultado.resultados) {
      candidatos.push({ ...lead, segmentoOrigem: r.segmento })
    }
  }
  return candidatos
}
