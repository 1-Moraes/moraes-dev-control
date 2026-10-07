// Filtros + ordenação dos resultados do Radar — Fase 3A. Mantém os filtros
// "Já no CRM"/"Ainda não enviados" da Fase 2F e acrescenta os filtros de
// oportunidade (score/presença digital) e a ordenação, todos compostos
// (aplicados juntos, nunca um substituindo o outro).
const FILTROS_OPORTUNIDADE = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'melhores', label: 'Melhores oportunidades' },
  { valor: 'sem_site', label: 'Sem site próprio identificado' },
  { valor: 'instagram_sem_site', label: 'Com Instagram, sem site' },
]

const OPCOES_ORDENACAO = [
  { valor: 'maior_score', label: 'Maior Opportunity Score' },
  { valor: 'menor_score', label: 'Menor Opportunity Score' },
  { valor: 'mais_avaliacoes', label: 'Mais avaliações' },
  { valor: 'melhor_avaliacao', label: 'Melhor avaliação' },
]

export default function FiltrosOportunidade({ filtroCrm, onFiltroCrm, filtrosCrm, filtroOportunidade, onFiltroOportunidade, ordenacao, onOrdenacao }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-(--color-line) bg-(--color-surface) p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-(--color-line) bg-(--color-canvas) p-0.5">
          {filtrosCrm.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => onFiltroCrm(f.valor)}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold ${filtroCrm === f.valor ? 'bg-(--color-primary) text-white' : 'text-(--color-ink-secondary)'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTROS_OPORTUNIDADE.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => onFiltroOportunidade(f.valor)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                filtroOportunidade === f.valor ? 'border-(--color-primary) bg-(--color-primary-bg) text-(--color-primary)' : 'border-(--color-line) text-(--color-ink-secondary)'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-1.5 text-[11px] text-(--color-ink-secondary)">
        Ordenar por
        <select
          value={ordenacao}
          onChange={(e) => onOrdenacao(e.target.value)}
          className="rounded-lg border border-(--color-line) bg-(--color-canvas) px-2 py-1 text-[11px] text-(--color-ink) outline-none focus:border-(--color-primary)"
        >
          {OPCOES_ORDENACAO.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
