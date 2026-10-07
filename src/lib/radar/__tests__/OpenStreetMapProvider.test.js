import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { raioDeBoundingBox, montarQueryOverpass, elementoParaEntry, buscar } from '../providers/OpenStreetMapProvider'

// Estes testes cobrem explicitamente o que o ajuste da Fase 3A exige (item
// 26): variação real de query por localidade, troca de localização sem
// "colar" na busca anterior, falha do provider, provider-sem-cobertura e
// zero-resultado — nunca um teste que só lê uma fixture e chama de "busca
// dinâmica".

describe('OpenStreetMapProvider / raioDeBoundingBox', () => {
  it('cresce com o tamanho do bounding box (cidade grande -> raio maior que bairro pequeno)', () => {
    // bounding box pequeno (~poucos km) vs. um bem maior — nenhuma cidade
    // nomeada aqui, só coordenadas, pra garantir que o cálculo é geométrico
    const bboxPequeno = ['-23.60', '-23.59', '-46.70', '-46.69']
    const bboxGrande = ['-24.00', '-23.00', '-47.00', '-46.00']
    expect(raioDeBoundingBox(bboxGrande)).toBeGreaterThan(raioDeBoundingBox(bboxPequeno))
  })

  it('limita o raio a [3000, 20000] metros', () => {
    const bboxMinusculo = ['-23.001', '-23.000', '-46.001', '-46.000']
    const bboxEnorme = ['-30', '10', '-60', '-20']
    expect(raioDeBoundingBox(bboxMinusculo)).toBeGreaterThanOrEqual(3000)
    expect(raioDeBoundingBox(bboxEnorme)).toBeLessThanOrEqual(20000)
  })

  it('cai no raio padrão (12000) para entrada inválida/ausente, nunca lança', () => {
    expect(raioDeBoundingBox(null)).toBe(12000)
    expect(raioDeBoundingBox(['a', 'b', 'c', 'd'])).toBe(12000)
    expect(raioDeBoundingBox([1, 2])).toBe(12000)
  })
})

describe('OpenStreetMapProvider / montarQueryOverpass', () => {
  it('usa filtro por tag quando o segmento é conhecido', () => {
    const q = montarQueryOverpass([{ k: 'shop', v: 'hairdresser' }], 'barbearia', -23.5, -46.6, 5000)
    expect(q).toContain('"shop"="hairdresser"')
    expect(q).toContain('around:5000,-23.5,-46.6')
  })

  it('cai para filtro de nome livre quando não há tag (segmento desconhecido) — nunca bloqueia a busca', () => {
    const q = montarQueryOverpass(null, 'serralheria', -23.5, -46.6, 5000)
    expect(q).toContain('"name"~"serralheria"')
  })

  it('a query muda de acordo com lat/lon/raio recebidos — não há valor fixo embutido', () => {
    const qCotia = montarQueryOverpass([{ k: 'shop', v: 'barber' }], 'barbearia', -23.6038, -46.9188, 8000)
    const qItapevi = montarQueryOverpass([{ k: 'shop', v: 'barber' }], 'barbearia', -23.5489, -47.0, 9000)
    expect(qCotia).not.toBe(qItapevi)
    expect(qCotia).toContain('-23.6038,-46.9188')
    expect(qItapevi).toContain('-23.5489,-47')
  })
})

describe('OpenStreetMapProvider / elementoParaEntry', () => {
  it('converte um elemento bruto do Overpass no mesmo formato Entry que o Normalizer espera', () => {
    const entry = elementoParaEntry({
      type: 'node',
      id: 123,
      lat: -23.6,
      lon: -46.7,
      tags: { name: 'Barbearia Exemplo', shop: 'barber', phone: '11999999999', website: 'https://ex.com', 'addr:city': 'Cotia', 'addr:state': 'SP' },
    })
    expect(entry.place_id).toBe('osm:node/123')
    expect(entry.title).toBe('Barbearia Exemplo')
    expect(entry.category).toBe('barber')
    expect(entry.complete_address.city).toBe('Cotia')
    expect(entry.latitude).toBe(-23.6)
    expect(entry.longtitude).toBe(-46.7)
    expect(entry.review_rating).toBeNull()
    expect(entry.review_count).toBeNull()
  })

  it('nunca inventa rating/reviewCount — OSM não é fonte de avaliações', () => {
    const entry = elementoParaEntry({ type: 'node', id: 1, tags: { name: 'X', amenity: 'restaurant' } })
    expect(entry.review_rating).toBeNull()
    expect(entry.review_count).toBeNull()
  })

  it('usa center.lat/lon quando o elemento é way/relation (sem lat/lon direto)', () => {
    const entry = elementoParaEntry({ type: 'way', id: 9, center: { lat: -23.1, lon: -46.2 }, tags: { name: 'Y' } })
    expect(entry.latitude).toBe(-23.1)
    expect(entry.longtitude).toBe(-46.2)
  })
})

describe('OpenStreetMapProvider / buscar (integração com fetch mockado)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  function mockGeocodificacaoOk(lat, lon, boundingbox) {
    return { ok: true, status: 200, json: async () => [{ lat: String(lat), lon: String(lon), boundingbox }] }
  }

  function mockOverpassOk(elements) {
    return { ok: true, status: 200, json: async () => ({ elements }) }
  }

  it('query executada muda genuinamente entre localizações diferentes (nenhum "if cidade" — mesma função, parâmetros diferentes)', async () => {
    global.fetch
      .mockResolvedValueOnce(mockGeocodificacaoOk(-23.6038, -46.9188, ['-23.65', '-23.55', '-46.95', '-46.88']))
      .mockResolvedValueOnce(mockOverpassOk([]))

    const resultadoCotia = await buscar({ segmento: 'barbearia', localizacao: 'Cotia, SP', quantidade: 10 })

    global.fetch
      .mockResolvedValueOnce(mockGeocodificacaoOk(-23.5489, -47.0, ['-23.60', '-23.50', '-47.05', '-46.95']))
      .mockResolvedValueOnce(mockOverpassOk([]))

    const resultadoItapevi = await buscar({ segmento: 'barbearia', localizacao: 'Itapevi, SP', quantidade: 10 })

    expect(resultadoCotia.metadados.pontoGeocodificado).not.toEqual(resultadoItapevi.metadados.pontoGeocodificado)
    // A query de geocodificação enviada pro fetch também muda com a localização.
    const urlChamadaCotia = global.fetch.mock.calls[0][0]
    expect(urlChamadaCotia).toContain(encodeURIComponent('Cotia, SP'))
  })

  it('não "cola" (cache implícito) entre buscas sucessivas — cada chamada geocodifica a localização pedida', async () => {
    global.fetch
      .mockResolvedValueOnce(mockGeocodificacaoOk(-23.6038, -46.9188, ['-23.65', '-23.55', '-46.95', '-46.88']))
      .mockResolvedValueOnce(mockOverpassOk([{ type: 'node', id: 1, lat: -23.6, lon: -46.9, tags: { name: 'Barbearia A', shop: 'barber' } }]))

    const r1 = await buscar({ segmento: 'barbearia', localizacao: 'Cotia, SP', quantidade: 10 })
    expect(r1.registros[0].title).toBe('Barbearia A')

    global.fetch
      .mockResolvedValueOnce(mockGeocodificacaoOk(-23.3, -46.3, ['-23.35', '-23.25', '-46.35', '-46.25']))
      .mockResolvedValueOnce(mockOverpassOk([{ type: 'node', id: 2, lat: -23.3, lon: -46.3, tags: { name: 'Barbearia B', shop: 'barber' } }]))

    const r2 = await buscar({ segmento: 'barbearia', localizacao: 'Barueri, SP', quantidade: 10 })
    expect(r2.registros[0].title).toBe('Barbearia B')
    expect(r2.registros).not.toEqual(r1.registros)
  })

  it('status PROVIDER_SEM_COBERTURA quando a geocodificação não reconhece a localização (fonte funcionou, só não achou o lugar)', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })

    const resultado = await buscar({ segmento: 'barbearia', localizacao: 'Localidade Inexistente Xyz', quantidade: 10 })
    expect(resultado.status).toBe('sem_cobertura')
    expect(resultado.registros).toEqual([])
  })

  it('status PROVIDER_INDISPONIVEL quando a fonte não pode nem ser consultada (erro de rede na geocodificação)', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'))

    const resultado = await buscar({ segmento: 'barbearia', localizacao: 'Cotia, SP', quantidade: 10 })
    expect(resultado.status).toBe('indisponivel')
    expect(resultado.mensagemErro).toBeTruthy()
  })

  it('status PROVIDER_INDISPONIVEL quando a Overpass falha mesmo com geocodificação ok', async () => {
    global.fetch
      .mockResolvedValueOnce(mockGeocodificacaoOk(-23.6, -46.9, ['-23.65', '-23.55', '-46.95', '-46.88']))
      .mockRejectedValueOnce(new Error('overpass timeout'))

    const resultado = await buscar({ segmento: 'barbearia', localizacao: 'Cotia, SP', quantidade: 10 })
    expect(resultado.status).toBe('indisponivel')
  })

  it('BUSCA_EXECUTADA_SEM_RESULTADOS quando a fonte responde mas não há elementos com nome', async () => {
    global.fetch
      .mockResolvedValueOnce(mockGeocodificacaoOk(-23.6, -46.9, ['-23.65', '-23.55', '-46.95', '-46.88']))
      .mockResolvedValueOnce(mockOverpassOk([{ type: 'node', id: 1, tags: {} }])) // sem "name" -> filtrado

    const resultado = await buscar({ segmento: 'barbearia', localizacao: 'Cotia, SP', quantidade: 10 })
    expect(resultado.status).toBe('sem_resultado')
    expect(resultado.registros).toEqual([])
  })

  it('multissegmento numa mesma localização gera queries diferentes por segmento (tags diferentes), apontando pro mesmo ponto geocodificado', async () => {
    global.fetch
      .mockResolvedValueOnce(mockGeocodificacaoOk(-23.51, -46.87, ['-23.55', '-23.47', '-46.92', '-46.82']))
      .mockResolvedValueOnce(mockOverpassOk([]))
    const barbearias = await buscar({ segmento: 'barbearia', localizacao: 'Barueri, SP', quantidade: 10 })

    global.fetch
      .mockResolvedValueOnce(mockGeocodificacaoOk(-23.51, -46.87, ['-23.55', '-23.47', '-46.92', '-46.82']))
      .mockResolvedValueOnce(mockOverpassOk([]))
    const dentistas = await buscar({ segmento: 'dentista', localizacao: 'Barueri, SP', quantidade: 10 })

    expect(barbearias.metadados.pontoGeocodificado).toEqual(dentistas.metadados.pontoGeocodificado)
    expect(barbearias.metadados.tagsUsadas).not.toEqual(dentistas.metadados.tagsUsadas)
  })
})
