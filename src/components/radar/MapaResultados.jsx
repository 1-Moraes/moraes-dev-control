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

import { useEffect, useRef } from 'react'
// Esta versão do maplibre-gl não tem export default — só nomeados.
import { Map as MapaLibre, LngLatBounds } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/positron'

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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MapaLibre({
      container: containerRef.current,
      style: ESTILO_MAPA,
      center: [-46.9, -23.62],
      zoom: 11,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.on('load', () => {
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
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só cria o mapa uma vez; leads/seleção são aplicados nos effects abaixo
  }, [])

  // Atualiza os pontos quando os resultados da busca mudam.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded() || !map.getSource('leads')) return
    aplicarLeads(map, leads, idsNumericos)
  }, [leads])

  // Destaca o lead selecionado (clique na lista) e centraliza o mapa nele.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getSource('leads')) return

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
  }, [selecionadoId, leads])

  return <div ref={containerRef} className="h-full w-full rounded-2xl" />
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
