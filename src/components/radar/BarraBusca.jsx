// Barra de busca do Radar — item 6 do planejamento (Segmento/Localização/
// Quantidade/Buscar), limites conservadores de quantidade. Fase 3A
// acrescenta "Buscas rápidas": chips de segmentos sugeridos (config
// centralizada em segmentosPreset.js) que só preenchem o campo Segmento —
// a busca livre por texto continua funcionando exatamente como antes, sem
// nenhuma restrição a essa lista.
import { Search } from 'lucide-react'
import { SEGMENTOS_SUGERIDOS } from '../../lib/radar/segmentosPreset'

const QUANTIDADES = [10, 20, 50]

export default function BarraBusca({ segmento, localizacao, quantidade, onChange, onBuscar, buscando }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onBuscar()
      }}
      className="flex flex-col gap-3 rounded-2xl border border-(--color-line) bg-(--color-surface) p-4 shadow-sm"
    >
      <div className="flex flex-wrap gap-1.5">
        {SEGMENTOS_SUGERIDOS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange({ segmento: s })}
            className="rounded-full border border-(--color-line) px-2.5 py-1 text-[11px] font-medium text-(--color-ink-secondary) hover:border-(--color-primary-soft) hover:text-(--color-primary)"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="text-xs font-medium text-(--color-ink-secondary)">Segmento</label>
        <input
          type="text"
          value={segmento}
          onChange={(e) => onChange({ segmento: e.target.value })}
          placeholder="Barbearias, Dentistas, Restaurantes..."
          maxLength={60}
          className="mt-1 w-full rounded-xl border border-(--color-line) bg-(--color-canvas) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
        />
      </div>
      <div className="flex-1">
        <label className="text-xs font-medium text-(--color-ink-secondary)">Localização</label>
        <input
          type="text"
          value={localizacao}
          onChange={(e) => onChange({ localizacao: e.target.value })}
          placeholder="Cotia, SP"
          maxLength={80}
          className="mt-1 w-full rounded-xl border border-(--color-line) bg-(--color-canvas) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
        />
      </div>
      <div className="sm:w-32">
        <label className="text-xs font-medium text-(--color-ink-secondary)">Quantidade</label>
        <select
          value={quantidade}
          onChange={(e) => onChange({ quantidade: Number(e.target.value) })}
          className="mt-1 w-full rounded-xl border border-(--color-line) bg-(--color-canvas) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
        >
          {QUANTIDADES.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={buscando || !segmento.trim() || !localizacao.trim()}
        className="flex items-center justify-center gap-2 rounded-xl bg-(--color-primary) px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-(--color-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Search size={16} />
        Buscar
      </button>
      </div>
    </form>
  )
}
