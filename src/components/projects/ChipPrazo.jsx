// Indicador discreto de prazo — itens 38/39 do planejamento da Fase 2E.
// Usado no painel panorâmico e nos cards do Kanban. Nunca pinta o
// componente pai inteiro, só o próprio chip.
import { calcularSituacaoPrazo } from '../../lib/projects/ProjectsService'

const ESTILOS = {
  sem_prazo: 'border-(--color-line) text-(--color-ink-secondary)',
  encerrado: 'border-(--color-line) text-(--color-ink-secondary)',
  normal: 'border-(--color-green-light)/40 text-(--color-green-light)',
  proximo: 'border-amber-400/50 text-amber-600',
  atrasado: 'border-(--color-danger)/40 text-(--color-danger)',
}

function texto(situacao, diasRestantes) {
  if (situacao === 'sem_prazo') return 'Sem prazo'
  if (situacao === 'encerrado') return 'Encerrado'
  if (situacao === 'atrasado') return `${Math.abs(diasRestantes)} dia${Math.abs(diasRestantes) === 1 ? '' : 's'} em atraso`
  if (diasRestantes === 0) return 'Entrega hoje'
  if (situacao === 'proximo') return `Entrega em ${diasRestantes} dia${diasRestantes === 1 ? '' : 's'}`
  return `${diasRestantes} dias restantes`
}

export default function ChipPrazo({ prazoPrevisto, status, className = '' }) {
  const { situacao, diasRestantes } = calcularSituacaoPrazo(prazoPrevisto, status)
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ESTILOS[situacao]} ${className}`}>
      {texto(situacao, diasRestantes)}
    </span>
  )
}
