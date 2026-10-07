import { describe, it, expect } from 'vitest'
import { SEGMENTOS_OSM, tagsParaSegmento } from '../providers/segmentosOsm'

describe('segmentosOsm / tagsParaSegmento', () => {
  it('é um dicionário palavra-chave→tag, nunca contendo nome de cidade/bairro/região', () => {
    // Guarda estrutural do item 2/23 do ajuste: isto é DADO, nunca um
    // `if (cidade === X)`. Nenhuma entrada pode conter um dos nomes de
    // localidade usados nos cenários de validação do ajuste.
    const localidadesProibidas = ['cotia', 'itapevi', 'barueri', 'osasco', 'sao paulo', 'são paulo', 'praia grande']
    const textoDicionario = JSON.stringify(SEGMENTOS_OSM).toLowerCase()
    localidadesProibidas.forEach((loc) => {
      expect(textoDicionario.includes(loc)).toBe(false)
    })
  })

  it('resolve o mesmo segmento para a mesma tag independentemente de acento/plural', () => {
    expect(tagsParaSegmento('Barbearias')).toEqual(tagsParaSegmento('barbearia'))
    expect(tagsParaSegmento('Dentista')).toEqual([{ k: 'amenity', v: 'dentist' }])
    expect(tagsParaSegmento('academias')).toEqual([{ k: 'leisure', v: 'fitness_centre' }])
  })

  it('a mesma função/tag vale para qualquer localização — não há acoplamento segmento+cidade', () => {
    // A tag resolvida para "barbearia" não depende de qual localização será
    // usada depois (isso é responsabilidade só do OpenStreetMapProvider, via
    // geocodificação) — aqui garantimos que a função nem recebe localização.
    expect(tagsParaSegmento.length).toBe(1)
    expect(tagsParaSegmento('barbearia')).toEqual(tagsParaSegmento('barbearia'))
  })

  it('devolve null para segmento sem correspondência conhecida (cai pro fallback de nome livre, nunca bloqueia)', () => {
    expect(tagsParaSegmento('serralheria')).toBeNull()
    expect(tagsParaSegmento('')).toBeNull()
    expect(tagsParaSegmento(undefined)).toBeNull()
  })
})
