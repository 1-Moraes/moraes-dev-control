// Drawer/painel lateral de detalhes do lead — item 11 do planejamento da
// Fase 2B. [Adicionar ao CRM] (item 14 da Fase 2C) foi adicionado aqui —
// a ação de persistir o lead no Supabase mora em LeadsService, chamada
// pelo Prospeccao.jsx (que também controla loading/confirmação/duplicata),
// nunca direto neste componente de apresentação.
import { Link } from 'react-router-dom'
import { X, Star, ExternalLink, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react'

// Rótulos legíveis para o identificador de provider salvo em lead.source
// (ajuste da Fase 3A — "busca dinâmica por localidade"). Qualquer provider
// não listado aqui cai no fallback `|| lead.source` (mostra o identificador
// bruto em vez de quebrar).
const LABEL_FONTE = {
  openstreetmap: 'OpenStreetMap (Nominatim + Overpass)',
  fixture_dev: 'Catálogo de teste (desenvolvimento)',
  desconhecido: 'Fonte não identificada',
}

function Campo({ label, valor }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">{label}</dt>
      <dd className="mt-0.5 text-sm text-(--color-ink)">{valor || '—'}</dd>
    </div>
  )
}

export default function DrawerDetalhesLead({ lead, candidato, onFechar, onSelecionarCandidato, noCrm, crmLeadId, enviandoCrm, onAdicionarAoCrm }) {
  if (!lead) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onFechar} />
      <div className="relative flex h-full w-full max-w-sm flex-col bg-(--color-surface) p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-(--color-ink)">{lead.name || 'Sem nome'}</h2>
            <p className="text-xs text-(--color-ink-secondary)">{lead.category}</p>
          </div>
          <button type="button" onClick={onFechar} className="rounded-lg p-1.5 text-(--color-ink-secondary) hover:bg-(--color-canvas)">
            <X size={18} />
          </button>
        </div>

        {noCrm ? (
          <span className="mt-2 inline-flex items-center gap-1 self-start rounded-full bg-(--color-green)/15 px-2 py-0.5 text-[11px] font-semibold text-(--color-green)">
            <CheckCircle2 size={11} /> Já no CRM
          </span>
        ) : null}

        {lead.duplicateGroup ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-(--color-amber)/30 bg-(--color-amber)/10 p-3 text-xs text-(--color-ink)">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-(--color-amber)" />
            <span>
              Possível duplicata (sinal: <strong>{lead.duplicateSignal}</strong>). Preservado na lista — revisar
              manualmente antes de tratar como o mesmo negócio de outro resultado.
            </span>
          </div>
        ) : null}

        <dl className="mt-5 space-y-4">
          <Campo label="Endereço" valor={lead.address} />
          <Campo label="Bairro" valor={lead.neighborhood} />
          <Campo label="Cidade/Estado" valor={[lead.city, lead.state].filter(Boolean).join(', ')} />
          <Campo label="Telefone" valor={lead.phone || 'Telefone não retornado pela fonte'} />
          <Campo label="Website" valor={lead.website || 'Website não retornado pela fonte'} />
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Avaliação</dt>
            <dd className="mt-0.5 flex items-center gap-1 text-sm text-(--color-ink)">
              {lead.rating ? (
                <>
                  <Star size={14} fill="#f0a63d" className="text-(--color-amber)" />
                  {lead.rating} ({lead.reviewCount || 0} avaliações)
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <Campo label="Coordenadas" valor={lead.latitude && lead.longitude ? `${lead.latitude}, ${lead.longitude}` : null} />
          <Campo label="Fonte" valor={LABEL_FONTE[lead.source] || lead.source} />
          <Campo label="Descoberto em" valor={lead.discoveredAt ? new Date(lead.discoveredAt).toLocaleString('pt-BR') : null} />
        </dl>

        <div className="mt-auto flex flex-col gap-2 pt-6">
          {lead.website ? (
            <a
              href={lead.website}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-(--color-line) px-4 py-2.5 text-sm font-semibold text-(--color-ink) hover:bg-(--color-canvas)"
            >
              Abrir website <ExternalLink size={14} />
            </a>
          ) : null}
          <button
            type="button"
            onClick={onSelecionarCandidato}
            disabled={candidato}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              candidato
                ? 'cursor-default bg-(--color-green)/15 text-(--color-green)'
                : 'bg-(--color-primary) text-white hover:bg-(--color-primary-hover)'
            }`}
          >
            {candidato ? 'Candidato selecionado' : 'Selecionar candidato'}
          </button>
          <p className="text-center text-[11px] text-(--color-ink-secondary)">
            Selecionar não cria lead no CRM — só marca interesse para análise posterior.
          </p>

          {noCrm && crmLeadId ? (
            <Link
              to={`/dashboard/crm?lead=${crmLeadId}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-(--color-green)/15 px-4 py-2.5 text-sm font-semibold text-(--color-green) hover:bg-(--color-green)/25"
            >
              <CheckCircle2 size={14} /> Abrir no CRM
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => onAdicionarAoCrm?.(lead)}
              disabled={enviandoCrm}
              className="flex items-center justify-center gap-2 rounded-xl border border-(--color-primary) px-4 py-2.5 text-sm font-semibold text-(--color-primary) transition hover:bg-(--color-primary-bg) disabled:opacity-60"
            >
              {enviandoCrm ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Adicionando...
                </>
              ) : (
                'Adicionar ao CRM'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
