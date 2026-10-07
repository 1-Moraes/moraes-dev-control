// Moldura comum das 8 seções do Dashboard — título, ícone, estado de
// carregamento (skeleton), erro isolado (não derruba o resto da tela) e
// estado vazio. Cada seção só cuida do próprio conteúdo via `children`.
import { AlertTriangle } from 'lucide-react'

export default function SecaoCard({ titulo, icon: Icon, acao, carregando, erro, vazio, mensagemVazia, className = '', children }) {
  return (
    <div className={`rounded-2xl border border-(--color-line) bg-(--color-surface) p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-(--color-ink)">
          {Icon ? <Icon size={15} className="text-(--color-ink-secondary)" /> : null}
          {titulo}
        </h2>
        {acao}
      </div>

      <div className="mt-3">
        {erro ? (
          <div className="flex items-center gap-2 rounded-xl border border-(--color-danger)/30 bg-(--color-status-problema-bg) px-3 py-2 text-xs text-(--color-ink)">
            <AlertTriangle size={13} className="shrink-0 text-(--color-danger)" />
            {erro}
          </div>
        ) : carregando ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-xl bg-(--color-canvas)" />
            ))}
          </div>
        ) : vazio ? (
          <p className="rounded-xl border border-dashed border-(--color-line) px-3 py-6 text-center text-xs text-(--color-ink-secondary)">
            {mensagemVazia || 'Nenhum dado por aqui ainda.'}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
