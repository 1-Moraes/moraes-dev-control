import Placeholder from './Placeholder'

// Dashboard principal — placeholder nesta fase. No projeto original este
// era o painel Kanban de chamados (Dashboard.jsx, 557 linhas); a lógica de
// Kanban/drag-and-drop será portada para o funil comercial numa fase futura
// (ver item 11 do planejamento: reaproveitar o drag-and-drop HTML5 nativo,
// sem adicionar biblioteca nova).
export default function Dashboard() {
  return <Placeholder titulo="Dashboard" descricao="Indicadores gerais do Moraes.Dev Control. O Kanban comercial (Descoberto → ... → Ganho/Perdido) entra aqui numa fase futura." />
}
