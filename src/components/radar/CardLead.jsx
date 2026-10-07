// Card de resultado de busca na lista do Radar — item 8 do planejamento
// da Fase 2B. Botão [Adicionar ao CRM] (item 14 da Fase 2C) aparece aqui
// só depois que o resultado já foi marcado como candidato — "candidato
// selecionado deve ganhar ação [Adicionar ao CRM]", conforme o pedido.
import { Link } from 'react-router-dom'
import { Star, Phone, Globe, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react'

// `noCrm`/`crmLeadId` (Fase 2F, item "Já no CRM") são sinais DIFERENTES de
// `candidato`: candidato é uma seleção manual desta sessão (localStorage);
// já estar no CRM vem da reconciliação contra o Supabase real (ver
// Prospeccao.jsx) e nunca remove o card da lista — só troca o selo/botão.
export default function CardLead({ lead, selecionado, candidato, noCrm, crmLeadId, enviandoCrm, onClick, onVerDetalhes, onAdicionarAoCrm }) {
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

      {noCrm ? (
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-(--color-green)/15 px-2 py-0.5 text-[11px] font-semibold text-(--color-green)">
          <CheckCircle2 size={11} /> Já no CRM
        </span>
      ) : null}

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

      {noCrm && crmLeadId ? (
        // Já existe no CRM (sinal real do Supabase, não só desta sessão) —
        // o card NUNCA sai da lista/mapa (item do planejamento): só a ação
        // muda de "Adicionar" para "Abrir", pra comparar trabalhado vs. não
        // trabalhado no mesmo lugar.
        <Link
          to={`/dashboard/crm?lead=${crmLeadId}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-(--color-green)/15 px-3 py-1.5 text-xs font-semibold text-(--color-green) hover:bg-(--color-green)/25"
        >
          <CheckCircle2 size={12} /> Abrir no CRM
        </Link>
      ) : candidato ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAdicionarAoCrm?.(lead)
          }}
          disabled={enviandoCrm}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-(--color-primary) px-3 py-1.5 text-xs font-semibold text-(--color-primary) transition hover:bg-(--color-primary-bg) disabled:opacity-60"
        >
          {enviandoCrm ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Adicionando...
            </>
          ) : (
            'Adicionar ao CRM'
          )}
        </button>
      ) : null}
    </div>
  )
}
