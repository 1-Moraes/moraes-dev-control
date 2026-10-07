// Dicionário segmento → tags do OpenStreetMap — Fase 3A, ajuste "busca
// dinâmica por localidade". Isto é DADO (uma tabela de associação
// palavra-chave→tag), nunca um `if (cidade === "X")`: nenhuma cidade,
// bairro ou região aparece aqui, só categorias de negócio — o mesmo
// segmento mapeado funciona em QUALQUER localidade informada pelo usuário.
//
// Quando o segmento digitado não corresponde a nenhuma entrada conhecida,
// `tagsParaSegmento` devolve `null` e o provider cai para uma busca por
// nome livre (ver OpenStreetMapProvider.js) — nunca inventa uma tag, nunca
// bloqueia a busca por segmento desconhecido.
function semAcento(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

export const SEGMENTOS_OSM = [
  { palavras: ['barbearia', 'barbearias', 'barber', 'barbeiro'], tags: [{ k: 'shop', v: 'hairdresser' }, { k: 'shop', v: 'barber' }] },
  { palavras: ['salao de beleza', 'salao', 'cabeleireiro', 'cabeleireira'], tags: [{ k: 'shop', v: 'hairdresser' }, { k: 'shop', v: 'beauty' }] },
  { palavras: ['clinica odontologica', 'dentista', 'dentistas', 'odontologia', 'odonto'], tags: [{ k: 'amenity', v: 'dentist' }] },
  { palavras: ['clinica de estetica', 'estetica', 'esteticista'], tags: [{ k: 'shop', v: 'beauty' }, { k: 'healthcare', v: 'clinic' }] },
  { palavras: ['restaurante', 'restaurantes'], tags: [{ k: 'amenity', v: 'restaurant' }] },
  { palavras: ['academia', 'academias', 'fitness'], tags: [{ k: 'leisure', v: 'fitness_centre' }] },
  { palavras: ['oficina mecanica', 'oficina', 'mecanica'], tags: [{ k: 'shop', v: 'car_repair' }] },
  { palavras: ['escritorio de advocacia', 'advocacia', 'advogado', 'advogados'], tags: [{ k: 'office', v: 'lawyer' }] },
  { palavras: ['contabilidade', 'contador', 'contadores'], tags: [{ k: 'office', v: 'accountant' }] },
  { palavras: ['imobiliaria', 'imobiliarias'], tags: [{ k: 'office', v: 'estate_agent' }] },
  { palavras: ['pet shop', 'petshop', 'pet'], tags: [{ k: 'shop', v: 'pet' }] },
  { palavras: ['escola', 'escolas', 'curso', 'cursos'], tags: [{ k: 'amenity', v: 'school' }] },
  { palavras: ['clinica veterinaria', 'veterinaria', 'veterinario'], tags: [{ k: 'amenity', v: 'veterinary' }] },
]

/**
 * @param {string} segmento - texto livre digitado pelo usuário
 * @returns {Array<{k:string, v:string}>|null} - null = sem correspondência conhecida (quem chama cai para busca por nome livre)
 */
export function tagsParaSegmento(segmento) {
  const seg = semAcento(segmento)
  if (!seg) return null
  const achado = SEGMENTOS_OSM.find((item) => item.palavras.some((p) => seg.includes(p) || p.includes(seg)))
  return achado ? achado.tags : null
}
