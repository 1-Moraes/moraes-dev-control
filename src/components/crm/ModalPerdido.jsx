// Modal de motivo (opcional/estruturado) ao mover um lead para PERDIDO —
// item 9 do planejamento da Fase 2C.
import { useState } from 'react'
import { MOTIVOS_PERDA } from '../../lib/crm/LeadsService'

export default function ModalPerdido({ lead, onCancelar, onConfirmar }) {
  const [motivo, setMotivo] = useState('')

  if (!lead) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onCancelar} />
      <div className="relative w-full max-w-sm rounded-2xl bg-(--color-surface) p-5 shadow-xl">
        <h2 className="font-display text-sm font-semibold text-(--color-ink)">Marcar "{lead.nome_empresa}" como perdido</h2>
        <p className="mt-1 text-xs text-(--color-ink-secondary)">Motivo opcional — ajuda a entender o funil com o tempo. O lead não é excluído.</p>

        <div className="mt-4 space-y-1.5">
          {MOTIVOS_PERDA.map((m) => (
            <label
              key={m.valor}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                motivo === m.valor ? 'border-(--color-primary) bg-(--color-primary-bg)' : 'border-(--color-line) hover:bg-(--color-canvas)'
              }`}
            >
              <input type="radio" name="motivo_perda" value={m.valor} checked={motivo === m.valor} onChange={() => setMotivo(m.valor)} className="accent-(--color-primary)" />
              {m.label}
            </label>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 rounded-xl border border-(--color-line) px-4 py-2 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar(motivo || null)}
            className="flex-1 rounded-xl bg-(--color-danger) px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Marcar como perdido
          </button>
        </div>
      </div>
    </div>
  )
}
