// Aviso de possível duplicata ao clicar [Adicionar ao CRM] — item 15 do
// planejamento da Fase 2C. Nunca bloqueia: só avisa e deixa a pessoa
// decidir entre abrir o registro existente ou adicionar mesmo assim.
import { AlertTriangle } from 'lucide-react'

export default function ModalDuplicataCrm({ info, onCancelar, onAbrirExistente, onAdicionarMesmoAssim }) {
  if (!info) return null
  const { leadExistente, sinal } = info

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onCancelar} />
      <div className="relative w-full max-w-sm rounded-2xl bg-(--color-surface) p-5 shadow-xl">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-(--color-amber)" />
          <div>
            <h2 className="font-display text-sm font-semibold text-(--color-ink)">Encontramos um lead possivelmente relacionado</h2>
            <p className="mt-1 text-xs text-(--color-ink-secondary)">
              Sinal de correspondência: <strong>{sinal}</strong>.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-(--color-line) bg-(--color-canvas) p-3 text-xs">
          <p className="font-semibold text-(--color-ink)">{leadExistente.nome_empresa}</p>
          <p className="mt-0.5 text-(--color-ink-secondary)">
            {[leadExistente.categoria, leadExistente.cidade].filter(Boolean).join(' · ') || '—'}
          </p>
          {leadExistente.telefone ? <p className="mt-0.5 text-(--color-ink-secondary)">{leadExistente.telefone}</p> : null}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onAbrirExistente}
            className="rounded-xl bg-(--color-primary) px-4 py-2 text-xs font-semibold text-white hover:bg-(--color-primary-hover)"
          >
            Abrir existente
          </button>
          <button
            type="button"
            onClick={onAdicionarMesmoAssim}
            className="rounded-xl border border-(--color-line) px-4 py-2 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)"
          >
            Adicionar mesmo assim
          </button>
          <button type="button" onClick={onCancelar} className="text-xs font-medium text-(--color-ink-secondary) hover:underline">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
