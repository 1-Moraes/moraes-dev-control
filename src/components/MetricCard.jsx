export default function MetricCard({ icon: Icon, label, value, accent, hint }) {
  return (
    <div className="flex items-start gap-3.5 rounded-2xl border border-(--color-line) bg-(--color-surface) p-4 shadow-sm">
      <div
        className="flex h-[51px] w-[51px] shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: accent + '1A', color: accent }}
      >
        <Icon size={23} strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        {/* Altura mínima reservada para o rótulo (2 linhas), para que o valor
            comece sempre na mesma posição vertical, mesmo quando o rótulo
            de um card quebra em 2 linhas e o do vizinho cabe em 1. */}
        <p className="flex min-h-[30px] items-start text-[11px] font-medium uppercase leading-tight tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 truncate font-display text-xl font-bold leading-tight text-(--color-ink)" title={typeof value === 'string' ? value : undefined}>
          {value}
        </p>
        {hint && <p className="mt-0.5 text-[11px] leading-tight text-slate-400">{hint}</p>}
      </div>
    </div>
  )
}
