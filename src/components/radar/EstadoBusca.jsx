// Estados da busca — item 7 do planejamento. Nunca mostra erro técnico
// cru ao usuário; detalhes técnicos só vão para o console/log do servidor
// (ver api/radar-buscar.js).
import { Radar, Loader2, SearchX, AlertCircle, ShieldAlert } from 'lucide-react'

const CONFIG = {
  inicial: {
    icon: Radar,
    titulo: 'Configure sua busca para encontrar oportunidades.',
    cor: 'text-(--color-ink-secondary)',
  },
  buscando: {
    icon: Loader2,
    titulo: 'Buscando empresas...',
    cor: 'text-(--color-primary)',
    girando: true,
  },
  normalizando: {
    icon: Loader2,
    titulo: 'Organizando resultados...',
    cor: 'text-(--color-primary)',
    girando: true,
  },
  sem_resultado: {
    icon: SearchX,
    titulo: 'Nenhuma empresa foi encontrada para esta busca.',
    cor: 'text-(--color-ink-secondary)',
  },
  erro: {
    icon: AlertCircle,
    titulo: 'Não foi possível concluir a busca.',
    cor: 'text-(--color-danger)',
  },
  bloqueio: {
    icon: ShieldAlert,
    titulo: 'A fonte interrompeu temporariamente a consulta.',
    cor: 'text-(--color-amber)',
  },
}

export default function EstadoBusca({ estado, detalhe }) {
  const config = CONFIG[estado]
  if (!config) return null
  const Icon = config.icon

  return (
    <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-(--color-line) p-8 text-center">
      <Icon size={28} className={`${config.cor} ${config.girando ? 'animate-spin' : ''}`} />
      <p className="text-sm font-medium text-(--color-ink)">{config.titulo}</p>
      {detalhe ? <p className="max-w-sm text-xs text-(--color-ink-secondary)">{detalhe}</p> : null}
    </div>
  )
}
