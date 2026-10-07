import Placeholder from './Placeholder'

// CRM / Leads — pipeline comercial de 9 estágios definido no item 10 do
// planejamento (Descoberto → Qualificado → Contato preparado → Contatado →
// Respondeu → Reunião → Proposta → Negociação → Ganho/Perdido). NÃO
// implementar CRM completo nesta fase — só a rota e o placeholder.
export default function Crm() {
  return <Placeholder titulo="CRM / Leads" descricao="Pipeline comercial de 9 estágios. Kanban reaproveitará o drag-and-drop nativo já usado no projeto original, sem biblioteca nova." />
}
