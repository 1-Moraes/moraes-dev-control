// MapaResultados — MapProvider do Radar de Prospecção (Fase 2B, itens 9-10).
//
// ESCOLHA: MapLibre GL JS + estilo OpenFreeMap, em vez de Google Maps
// JavaScript API. Comparativo (ver relatório final da Fase 2B para a
// tabela completa):
//   - custo: MapLibre é open-source (licença BSD-3) e o estilo
//     OpenFreeMap é servido de graça, sem chave de API e sem limite de
//     requisições cobrado — Google Maps JS API exige chave + billing
//     habilitado, com cota gratuita limitada por mês.
//   - licenciamento: dados do mapa sob ODbL (OpenStreetMap/OpenMapTiles),
//     exige só atribuição visível (incluída abaixo via AttributionControl).
//   - integração React: usada aqui via ref direta (sem wrapper adicional),
//     poucas linhas de glue code.
//   - clustering/fitBounds/markers: tudo nativo da própria lib, sem
//     plugin pago.
// Dado que o item 9 do planejamento pede explicitamente priorizar essa
// opção "se permitir entregar o MVP de forma confiável, sem criar custo
// desnecessário" — e aqui atende integralmente — não há motivo para usar
// Google Maps JS API nesta fase. Nenhum serviço pago foi habilitado.
//
// Arquitetura: este componente só recebe `leads` (já normalizados, com
// latitude/longitude) e é inteiramente independente da fonte de descoberta
// — não importa nada de src/lib/radar/providers/.
//
// CORREÇÃO (mapa não renderizava em produção — só o fundo vazio + a
// atribuição apareciam): ver nota antes de ESTILO_MAPA, mais abaixo.

import { useCallback, useEffect, useRef, useState } from 'react'
// Esta versão do maplibre-gl não tem export default — só nomeados.
import { Map as MapaLibre, LngLatBounds } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { AlertTriangle, RefreshCw } from 'lucide-react'

// Estilo "Positron" do OpenFreeMap — confirmado contra a documentação atual
// (openfreemap.org/quick_start) e contra o próprio style.json em produção
// nesta correção: ainda é o endpoint correto, versão 8, com sprite/glyphs/
// fontes de tiles todos sob o mesmo domínio tiles.openfreemap.org (sem
// mixed content, sem domínio secundário). Gratuito, sem chave, sem limite
// cobrado — mantido como MapProvider principal.
const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/positron'

// Tempo máximo de espera pelo evento "load" (ou "error") do MapLibre antes
// de considerarmos a inicialização travada e mostrarmos o estado de erro —
// cobre o caso de uma falha de rede/CORS que não dispara um evento "error"
// capturável pela lib (ex.: alguns bloqueios no nível do navegador).
const TIMEOUT_CARREGAMENTO_MS = 12000

function leadsParaGeoJSON(leads) {
  return {
    type: 'FeatureCollection',
    features: leads
      .filter((l) => l.latitude && l.longitude)
      .map((l) => ({
        type: 'Feature',
        id: typeof l.id === 'string' ? hashId(l.id) : l.id,
        geometry: { type: 'Point', coordinates: [l.longitude, l.latitude] },
        properties: { leadId: l.id, name: l.name, category: l.category },
      })),
  }
}

// GeoJSON feature.id precisa ser número/inteiro para feature-state — os
// ids de lead vêm de sourceId (string, ex. place_id) ou "tmp-N". Hash
// simples e estável só para uso como chave numérica interna do mapa.
function hashId(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export default function MapaResultados({ leads, selecionadoId, onSelecionar }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const idsNumericos = useRef(new Map())
  const timeoutRef = useRef(null)
  const resizeObserverRef = useRef(null)
  // Espelha `estado` para uso dentro de callbacks do MapLibre sem precisar
  // recriar os listeners a cada render (evita closures com estado antigo).
  const estadoRef = useRef('carregando')

  // "carregando" | "ok" | "erro" — estado de inicialização do próprio mapa
  // (estilo + tiles), independente de `leads` (resultados da busca).
  const [estado, setEstado] = useState('carregando')
  // Incrementar força a recriação completa do mapa (botão "Tentar novamente").
  const [tentativa, setTentativa] = useState(0)

  const marcarEstado = useCallback((novo) => {
    estadoRef.current = novo
    setEstado(novo)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    marcarEstado('carregando')

    const map = new MapaLibre({
      container: containerRef.current,
      style: ESTILO_MAPA,
      center: [-46.9, -23.62],
      zoom: 11,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    // Diagnóstico (item 3 do pedido): erro real de estilo/tile/fonte/sprite
    // — nunca registra secrets, só a mensagem/URL/status do próprio evento
    // do MapLibre. Enquanto o mapa ainda não carregou com sucesso uma vez,
    // qualquer "error" aqui é tratado como fatal para a inicialização.
    map.on('error', (e) => {
      const erro = e?.error
      console.error('[Radar/Mapa] evento de erro do MapLibre', {
        mensagem: erro?.message || String(erro) || 'sem mensagem',
        status: erro?.status ?? null,
        url: erro?.url ?? null,
      })
      if (estadoRef.current !== 'ok') {
        marcarEstado('erro')
      }
    })

    map.on('load', () => {
      clearTimeout(timeoutRef.current)
      console.log('[Radar/Mapa] estilo e fontes carregados com sucesso')
      marcarEstado('ok')

      map.addSource('leads', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 45,
        clusterMaxZoom: 15,
      })

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'leads',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#2663f2',
          'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 25, 26],
        },
      })
      map.addLayer({
        id: 'clusters-label',
        type: 'symbol',
        source: 'leads',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 },
        paint: { 'text-color': '#ffffff' },
      })
      map.addLayer({
        id: 'pontos',
        type: 'circle',
        source: 'leads',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'case',
            ['boolean', ['feature-state', 'selecionado'], false],
            '#f0a63d',
            '#2663f2',
          ],
          'circle-radius': ['case', ['boolean', ['feature-state', 'selecionado'], false], 10, 7],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
        const clusterId = features[0].properties.cluster_id
        map.getSource('leads').getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return
          map.easeTo({ center: features[0].geometry.coordinates, zoom })
        })
      })

      map.on('click', 'pontos', (e) => {
        const leadId = e.features[0].properties.leadId
        onSelecionar?.(leadId)
      })

      map.on('mouseenter', 'pontos', () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', 'pontos', () => (map.getCanvas().style.cursor = ''))
      map.on('mouseenter', 'clusters', () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', 'clusters', () => (map.getCanvas().style.cursor = ''))

      aplicarLeads(map, leads, idsNumericos)

      // Correção do sintoma "fundo vazio + atribuição aparece": se o
      // container ainda não tinha dimensões definitivas no instante em que
      // o mapa foi construído (CSS do maplibre-gl carregado em chunk
      // separado via code-splitting, troca do fallback do Suspense, aba
      // lista/mapa no mobile, etc.), o canvas WebGL pode ficar com tamanho
      // 0 ou desatualizado mesmo com o estilo e as fontes já carregados —
      // a atribuição (controle HTML, não depende do canvas) aparece, mas
      // nenhum tile é desenhado. Forçar um resize explícito aqui garante
      // que o canvas sempre reflita o tamanho real do container assim que
      // o estilo termina de carregar.
      map.resize()
    })

    // Mesma correção acima, de forma contínua: observa o próprio container
    // e redimensiona o mapa sempre que o tamanho dele mudar (troca de aba
    // lista/mapa no mobile, sidebar, layout ainda assentando no primeiro
    // paint, etc.) em vez de confiar só no tamanho no instante da criação.
    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.resize()
    })
    resizeObserver.observe(containerRef.current)
    resizeObserverRef.current = resizeObserver

    // Watchdog: se nem "load" nem "error" chegarem a tempo (ex.: bloqueio
    // de rede/CORS que o navegador não reporta como evento capturável pela
    // lib), não deixar a área do mapa presa num "carregando" infinito.
    timeoutRef.current = setTimeout(() => {
      if (estadoRef.current === 'carregando') {
        console.error('[Radar/Mapa] timeout: nem "load" nem "error" chegaram em', TIMEOUT_CARREGAMENTO_MS, 'ms')
        marcarEstado('erro')
      }
    }, TIMEOUT_CARREGAMENTO_MS)

    return () => {
      clearTimeout(timeoutRef.current)
      resizeObserverRef.current?.disconnect()
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recria o mapa do zero só quando `tentativa` muda (botão "Tentar novamente"); leads/seleção são aplicados nos effects abaixo
  }, [tentativa, marcarEstado])

  // Atualiza os pontos quando os resultados da busca mudam.
  useEffect(() => {
    const map = mapRef.current
    if (!map || estado !== 'ok' || !map.isStyleLoaded() || !map.getSource('leads')) return
    aplicarLeads(map, leads, idsNumericos)
  }, [leads, estado])

  // Destaca o lead selecionado (clique na lista) e centraliza o mapa nele.
  useEffect(() => {
    const map = mapRef.current
    if (!map || estado !== 'ok' || !map.getSource('leads')) return

    idsNumericos.current.forEach((numId) => {
      try {
        map.setFeatureState({ source: 'leads', id: numId }, { selecionado: false })
      } catch {
        /* feature pode ainda não existir na fonte — ignora */
      }
    })

    if (selecionadoId == null) return
    const numId = idsNumericos.current.get(selecionadoId)
    if (numId == null) return
    map.setFeatureState({ source: 'leads', id: numId }, { selecionado: true })

    const lead = leads.find((l) => l.id === selecionadoId)
    if (lead?.latitude && lead?.longitude) {
      map.easeTo({ center: [lead.longitude, lead.latitude], zoom: Math.max(map.getZoom(), 15) })
    }
  }, [selecionadoId, leads, estado])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full rounded-2xl" />

      {estado !== 'ok' ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-(--color-surface)">
          {estado === 'erro' ? (
            <div className="flex max-w-xs flex-col items-center gap-2 px-4 text-center">
              <AlertTriangle size={24} className="text-amber-500" />
              <p className="text-sm font-medium text-(--color-ink)">Não foi possível carregar o mapa.</p>
              <p className="text-xs text-(--color-ink-secondary)">A lista de empresas continua disponível ao lado.</p>
              <button
                type="button"
                onClick={() => setTentativa((t) => t + 1)}
                className="mt-1 flex items-center gap-1.5 rounded-xl bg-(--color-primary) px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-(--color-primary-hover)"
              >
                <RefreshCw size={13} />
                Tentar novamente
              </button>
            </div>
          ) : (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--color-line) border-t-(--color-primary)" />
          )}
        </div>
      ) : null}
    </div>
  )
}

function aplicarLeads(map, leads, idsNumericosRef) {
  const geojson = leadsParaGeoJSON(leads)
  idsNumericosRef.current = new Map(geojson.features.map((f) => [f.properties.leadId, f.id]))
  map.getSource('leads').setData(geojson)

  const coords = geojson.features.map((f) => f.geometry.coordinates)
  if (coords.length === 0) return
  if (coords.length === 1) {
    map.easeTo({ center: coords[0], zoom: 14 })
    return
  }
  const bounds = coords.reduce(
    (b, c) => b.extend(c),
    new LngLatBounds(coords[0], coords[0])
  )
  map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 })
}
