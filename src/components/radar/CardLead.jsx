// Card de resultado de busca na lista do Radar — item 8 do planejamento.
import { Star, Phone, Globe, AlertTriangle } from 'lucide-react'

export default function CardLead({ lead, selecionado, candidato, onClick, onVerDetalhes }) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition ${
        selecionado
          ? 'border-(--color-primary) bg-(--color-primary-bg)'
          : 'border-(--color-line) bg-(--color-surface) hover:border-(--color-primary-soft)'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-(--color-ink)">{lead.name || 'Sem nome'}</h3>
        {lead.rating ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-(--color-ink)">
            <Star size={13} fill="#f0a63d" className="text-(--color-amber)" />
            {lead.rating}
          </span>
        ) : null}
      </div>

      <p className="mt-0.5 text-xs text-(--color-ink-secondary)">
        {[lead.category, lead.neighborhood || lead.city].filter(Boolean).join(' · ')}
      </p>

      {lead.duplicateGroup ? (
        <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-(--color-amber)">
          <AlertTriangle size={12} />
          Possível duplicata — revisar manualmente
        </div>
      ) : null}

      <div className="mt-3 space-y-1 text-xs text-(--color-ink-secondary)">
        <div className="flex items-center gap-1.5">
          <Phone size={13} />
          {lead.phone || 'Telefone não retornado pela fonte'}
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <Globe size={13} />
          {lead.website ? (
            <span className="truncate">{lead.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
          ) : (
            'Website não retornado pela fonte'
          )}
        </div>
        {lead.reviewCount ? <p>{lead.reviewCount} avaliações</p> : null}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onVerDetalhes?.()
          }}
          className="text-xs font-semibold text-(--color-primary) hover:underline"
        >
          Ver detalhes
        </button>
        {candidato ? (
          <span className="rounded-full bg-(--color-green)/15 px-2 py-0.5 text-[11px] font-semibold text-(--color-green)">
            Candidato selecionado
          </span>
        ) : null}
      </div>
    </div>
  )
}
