import Placeholder from './Placeholder'

// IA / Automações — NÃO integrar nenhum provider de IA nesta fase (item 16
// do planejamento). Arquitetura conceitual: AIService abstrato com
// AnthropicProvider / OpenAIProvider / FutureProvider, chamada sempre
// server-side (nunca API key no frontend). Ver src/lib/ai/ (vazio/placeholder).
export default function IaAutomacoes() {
  return <Placeholder titulo="IA / Automações" descricao="Arquitetura AIService (multiprovedor, server-side) preparada em src/lib/ai/ — nenhum provider integrado ainda." />
}
