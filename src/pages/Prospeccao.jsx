import Placeholder from './Placeholder'

// Radar de Prospecção — NÃO implementar funcionalmente nesta fase (item 18
// do planejamento). Arquitetura futura: Pesquisa → PlacesProvider →
// SearchProvider → WebsiteAnalyzer → Deduplicação → Score determinístico →
// AIService → CRM. Nenhum provedor externo (Google Places, Brave Search
// etc.) deve ser acoplado diretamente — sempre por abstração substituível.
export default function Prospeccao() {
  return <Placeholder titulo="Prospecção" descricao="Radar de prospecção. Arquitetura (busca → score determinístico → IA → CRM) preparada em fase futura, sem integrar nenhum provedor externo ainda." />
}
