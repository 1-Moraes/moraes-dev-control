// Segmentos sugeridos ("Buscas rápidas") — Fase 3A. Lista centralizada,
// nunca hardcoded dentro de um componente JSX: qualquer ajuste futuro na
// lista (adicionar/remover um segmento sugerido) muda só este arquivo. A
// busca livre por texto (BarraBusca) continua funcionando sem nenhuma
// alteração — isto é só um conjunto de atalhos, nunca uma lista fechada.
export const SEGMENTOS_SUGERIDOS = [
  'Barbearias',
  'Salões de beleza',
  'Clínicas odontológicas',
  'Clínicas de estética',
  'Restaurantes',
  'Academias',
  'Oficinas mecânicas',
  'Escritórios de advocacia',
  'Contabilidades',
  'Imobiliárias',
  'Pet shops',
  'Escolas e cursos',
  'Clínicas veterinárias',
]

// Buscas multissegmento — limite de segmentos por rodada (evita uma rodada
// gigante e lenta) e concorrência controlada (nunca dispara tudo de uma
// vez — pedido explícito do planejamento).
export const LIMITE_SEGMENTOS_MULTIBUSCA = 5
export const CONCORRENCIA_MULTIBUSCA = 2
