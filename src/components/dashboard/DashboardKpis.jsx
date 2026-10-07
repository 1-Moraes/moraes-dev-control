// KPIs do Dashboard (Fase 2F) — 4 indicadores, 100% dados reais (ver regras
// documentadas em DashboardService.obterMetricas). Grid 2x2 no mobile,
// horizontal no desktop (item de responsividade do planejamento).
import { Users2, Handshake, FolderKanban, Wallet, AlertTriangle } from 'lucide-react'
import { obterMetricas } from '../../lib/dashboard/DashboardService'
import { formatarMoeda } from '../../lib/helpers'
import { useSecaoDados } from './useSecaoDados'

const CARDS = [
  { chave: 'leadsAtivos', label: 'Leads ativos', icon: Users2 },
  { chave: 'clientesAtivos', label: 'Clientes ativos', icon: Handshake },
  { chave: 'projetosAtivos', label: 'Projetos ativos', icon: FolderKanban },
  { chave: 'valorContratado', label: 'Valor contratado', icon: Wallet, moeda: true },
]

export default function DashboardKpis({ refreshKey }) {
  const { dados, carregando, erro } = useSecaoDados(obterMetricas, refreshKey)

  if (erro) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 flex items-center gap-2 rounded-2xl border border-(--color-danger)/30 bg-(--color-status-problema-bg) px-3 py-3 text-xs text-(--color-ink) lg:col-span-4">
          <AlertTriangle size={14} className="shrink-0 text-(--color-danger)" />
          {erro}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map(({ chave, label, icon: Icon, moeda }) => (
        <div key={chave} className="rounded-2xl border border-(--color-line) bg-(--color-surface) p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-(--color-ink-secondary)">{label}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-primary-bg) text-(--color-primary)">
              <Icon size={15} />
            </span>
          </div>
          {carregando ? (
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-(--color-canvas)" />
          ) : (
            <p className="mt-3 truncate font-display text-2xl font-semibold text-(--color-ink)" title={moeda ? formatarMoeda(dados?.[chave]) : undefined}>
              {moeda ? formatarMoeda(dados?.[chave]) : dados?.[chave] ?? 0}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
