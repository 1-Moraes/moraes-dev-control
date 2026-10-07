import { Users2, Handshake, FolderKanban, DollarSign, Radar } from 'lucide-react'

// Dashboard principal — ainda sem nenhum dado real (não existe Supabase
// conectado nesta fase, nem CRM/Radar implementados). Regra explícita da
// Fase 0.5 (item 14 do planejamento): NUNCA simular números como se fossem
// dados reais da operação (ex.: "127 leads", "R$ 8.450", "18 clientes").
// Por isso cada indicador abaixo mostra um estado zerado/vazio de verdade —
// "—" ou "Nenhum dado disponível" — em vez de qualquer número inventado. A
// estrutura visual (cards, funil, atividades) já fica pronta para quando
// esses dados existirem de verdade.
const INDICADORES = [
  { label: 'Leads ativos', icon: Users2 },
  { label: 'Clientes', icon: Handshake },
  { label: 'Projetos em andamento', icon: FolderKanban },
  { label: 'Receita no mês', icon: DollarSign },
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-(--color-ink)">Dashboard</h1>
        <p className="mt-0.5 text-sm text-(--color-ink-secondary)">
          Visão geral do Moraes.Dev Control. Os indicadores abaixo ficam zerados até existir um Supabase real conectado.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {INDICADORES.map(({ label, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-(--color-line) bg-(--color-surface) p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-(--color-ink-secondary)">{label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-primary-bg) text-(--color-primary)">
                <Icon size={15} />
              </span>
            </div>
            <p className="mt-3 font-display text-2xl font-semibold text-(--color-ink)">—</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-(--color-line) bg-(--color-surface) p-5 shadow-sm lg:col-span-2">
          <h2 className="font-display text-sm font-semibold text-(--color-ink)">Funil comercial</h2>
          <p className="mt-0.5 text-xs text-(--color-ink-secondary)">
            Descoberto → Qualificado → Contato preparado → Contatado → Respondeu → Reunião → Proposta → Negociação → Ganho/Perdido
          </p>
          <div className="mt-6 flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--color-line) text-center">
            <Radar size={20} className="text-(--color-ink-secondary)" />
            <p className="text-xs font-medium text-(--color-ink-secondary)">Nenhum dado disponível ainda</p>
            <p className="max-w-xs text-[11px] text-(--color-ink-secondary)">
              O CRM/Kanban comercial entra em uma fase futura, com autorização.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-(--color-line) bg-(--color-surface) p-5 shadow-sm">
          <h2 className="font-display text-sm font-semibold text-(--color-ink)">Atividades recentes</h2>
          <div className="mt-6 flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--color-line) text-center">
            <p className="text-xs font-medium text-(--color-ink-secondary)">Nenhuma atividade registrada</p>
          </div>
        </div>
      </div>
    </div>
  )
}
