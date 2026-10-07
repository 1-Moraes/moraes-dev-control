// Painel "Ver análise" — Fase 3A, item "detalhe completo do Opportunity
// Score". O card na lista mostra só o score compacto (ver CardLead.jsx);
// todo o detalhe — critérios com pontuação, evidências, presença digital,
// correção manual — mora aqui, nunca espremido no card.
//
// Este componente é só apresentação + formulário de correção manual; quem
// decide COMO persistir a correção (Radar ainda não-CRM vs. lead já no CRM)
// é o Prospeccao.jsx, via `onSalvarPresencaManual` — o mesmo padrão já usado
// em DrawerDetalhesLead.jsx para "Adicionar ao CRM".
import { useState } from 'react'
import { X, Gauge, Globe, AtSign, Loader2, CheckCircle2, XCircle, RotateCcw, ShieldCheck } from 'lucide-react'

const COR_SCORE = {
  verde: 'bg-(--color-green)/15 text-(--color-green)',
  azul: 'bg-(--color-primary-bg) text-(--color-primary)',
  amber: 'bg-(--color-amber)/15 text-(--color-amber)',
  neutro: 'bg-(--color-canvas) text-(--color-ink-secondary)',
}

const LABEL_CATEGORIA = {
  site_proprio_identificado: 'Site próprio identificado',
  rede_social_identificada: 'Presença em rede social identificada',
  plataforma_externa_identificada: 'Presença em plataforma externa identificada',
  presenca_indefinida: 'Presença digital não identificada automaticamente',
  ausencia_confirmada: 'Ausência de site confirmada manualmente',
}

const LABEL_CONFIRMACAO = {
  nao_confirmado: 'Não confirmado manualmente',
  confirmado_tem: 'Confirmado manualmente: possui presença digital',
  confirmado_nao_tem: 'Confirmado manualmente: não possui site',
}

export default function DrawerAnaliseLead({ lead, analise, noCrm, onFechar, onSalvarPresencaManual, salvando }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState(() => ({
    siteUrlManual: lead?.siteUrlManual || '',
    instagramUrl: lead?.instagramUrlManual || lead?.instagram_url || '',
    facebookUrl: lead?.facebookUrlManual || lead?.facebook_url || '',
  }))

  if (!lead || !analise) return null
  const { presenca } = analise

  function salvar(confirmacao) {
    onSalvarPresencaManual?.({
      confirmacao,
      siteUrlManual: form.siteUrlManual.trim() || null,
      instagramUrl: form.instagramUrl.trim() || null,
      facebookUrl: form.facebookUrl.trim() || null,
    })
    setEditando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onFechar} />
      <div className="relative flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto bg-(--color-surface) p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-(--color-ink)">Análise de oportunidade</h2>
            <p className="text-xs text-(--color-ink-secondary)">{lead.name}</p>
          </div>
          <button type="button" onClick={onFechar} className="rounded-lg p-1.5 text-(--color-ink-secondary) hover:bg-(--color-canvas)">
            <X size={18} />
          </button>
        </div>

        {/* Score + classificação */}
        <div className="flex items-center gap-3 rounded-2xl border border-(--color-line) p-4">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-sm font-bold ${COR_SCORE[analise.classificacaoCor] || COR_SCORE.neutro}`}>
            {analise.score}
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-(--color-ink)">{analise.classificacao}</p>
            <p className="text-[11px] text-(--color-ink-secondary)">
              Opportunity Score v{analise.scoreVersion} · calculado em {new Date(analise.calculadoEm).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Critérios */}
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-(--color-ink-secondary)">Critérios do score</h3>
          <ul className="space-y-2">
            {analise.criterios.map((c) => (
              <li key={c.componente} className="rounded-xl border border-(--color-line) p-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-(--color-ink)">
                  <span>{c.componente}</span>
                  <span>
                    {c.pontos}/{c.max}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-(--color-ink-secondary)">{c.label}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Presença digital + evidências */}
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--color-ink-secondary)">
            <Gauge size={12} /> Presença digital
          </h3>
          <div className="rounded-xl border border-(--color-line) p-3 text-xs text-(--color-ink)">
            <p className="font-semibold">{LABEL_CATEGORIA[presenca.categoria]}</p>
            <p className="mt-0.5 text-(--color-ink-secondary)">{LABEL_CONFIRMACAO[presenca.confirmacao]}</p>
            {presenca.evidencias.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {presenca.evidencias.map((ev, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-[11px] text-(--color-ink-secondary)">
                    {ev.tipo.includes('instagram') || ev.tipo.includes('facebook') ? <AtSign size={11} /> : <Globe size={11} />}
                    <span className="truncate">{ev.valor}</span>
                    <span className="ml-auto shrink-0 rounded-full bg-(--color-canvas) px-1.5 py-0.5">
                      {ev.origem === 'manual' ? 'manual' : 'automático'} · confiança {ev.confianca}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-(--color-ink-secondary)">Nenhuma evidência de presença digital disponível.</p>
            )}
          </div>
        </div>

        {/* Dados complementares */}
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-[11px] text-(--color-ink-secondary)">Avaliação</dt>
            <dd className="text-(--color-ink)">{lead.rating ? `${lead.rating} (${lead.reviewCount || 0} avaliações)` : '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-(--color-ink-secondary)">Telefone</dt>
            <dd className="text-(--color-ink)">{lead.phone || '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] text-(--color-ink-secondary)">Localização</dt>
            <dd className="text-(--color-ink)">{[lead.address, lead.city, lead.state].filter(Boolean).join(', ') || '—'}</dd>
          </div>
        </dl>

        {/* Correção manual */}
        <div className="mt-auto rounded-2xl border border-dashed border-(--color-line) p-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--color-ink-secondary)">
              <ShieldCheck size={12} /> Correção manual
            </h3>
            {!editando ? (
              <button type="button" onClick={() => setEditando(true)} className="text-[11px] font-semibold text-(--color-primary) hover:underline">
                Editar
              </button>
            ) : null}
          </div>

          {!editando ? (
            <p className="mt-2 text-[11px] text-(--color-ink-secondary)">
              A confirmação manual tem precedência sobre qualquer análise automática futura — reanalisar nunca reverte o que foi confirmado aqui.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              <input
                type="url"
                placeholder="URL do site (se tiver)"
                value={form.siteUrlManual}
                onChange={(e) => setForm((f) => ({ ...f, siteUrlManual: e.target.value }))}
                className="w-full rounded-lg border border-(--color-line) bg-(--color-canvas) px-2.5 py-1.5 text-xs text-(--color-ink) outline-none focus:border-(--color-primary)"
              />
              <input
                type="url"
                placeholder="Link do Instagram (opcional)"
                value={form.instagramUrl}
                onChange={(e) => setForm((f) => ({ ...f, instagramUrl: e.target.value }))}
                className="w-full rounded-lg border border-(--color-line) bg-(--color-canvas) px-2.5 py-1.5 text-xs text-(--color-ink) outline-none focus:border-(--color-primary)"
              />
              <input
                type="url"
                placeholder="Link do Facebook (opcional)"
                value={form.facebookUrl}
                onChange={(e) => setForm((f) => ({ ...f, facebookUrl: e.target.value }))}
                className="w-full rounded-lg border border-(--color-line) bg-(--color-canvas) px-2.5 py-1.5 text-xs text-(--color-ink) outline-none focus:border-(--color-primary)"
              />

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => salvar('confirmado_tem')}
                  className="flex items-center gap-1 rounded-lg bg-(--color-green)/15 px-2.5 py-1.5 text-[11px] font-semibold text-(--color-green) hover:bg-(--color-green)/25 disabled:opacity-60"
                >
                  <CheckCircle2 size={12} /> Tem site/presença
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => salvar('confirmado_nao_tem')}
                  className="flex items-center gap-1 rounded-lg bg-(--color-danger)/15 px-2.5 py-1.5 text-[11px] font-semibold text-(--color-danger) hover:bg-(--color-danger)/25 disabled:opacity-60"
                >
                  <XCircle size={12} /> Não tem site
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => salvar('nao_confirmado')}
                  className="flex items-center gap-1 rounded-lg border border-(--color-line) px-2.5 py-1.5 text-[11px] font-semibold text-(--color-ink-secondary) hover:bg-(--color-canvas) disabled:opacity-60"
                >
                  {salvando ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Voltar para "não confirmado"
                </button>
              </div>
              {!noCrm ? (
                <p className="text-[11px] text-(--color-ink-secondary)">
                  Este candidato ainda não está no CRM — a confirmação fica só nesta sessão/cache até ser enviado.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
