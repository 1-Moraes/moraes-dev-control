// Aviso de possível cliente duplicado ao converter um lead — item 7 do
// planejamento da Fase 2D. Nunca bloqueia: só avisa e deixa a pessoa
// decidir entre abrir o cliente existente ou, quando tecnicamente seguro
// (ver nota em ClientsService.converterLeadEmCliente), usar o mesmo
// cliente sem criar outro.
import { AlertTriangle } from 'lucide-react'

export default function ModalDuplicataCliente({ info, onCancelar, onAbrirExistente, onUsarEsteCliente }) {
  if (!info) return null
  const { clienteExistente, sinal } = info

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onCancelar} />
      <div className="relative w-full max-w-sm rounded-2xl bg-(--color-surface) p-5 shadow-xl">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-(--color-amber)" />
          <div>
            <h2 className="font-display text-sm font-semibold text-(--color-ink)">Encontramos um cliente possivelmente relacionado</h2>
            <p className="mt-1 text-xs text-(--color-ink-secondary)">
              Sinal de correspondência: <strong>{sinal}</strong>.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-(--color-line) bg-(--color-canvas) p-3 text-xs">
          <p className="font-semibold text-(--color-ink)">{clienteExistente.nome_empresa}</p>
          <p className="mt-0.5 text-(--color-ink-secondary)">{clienteExistente.cidade || '—'}</p>
          {clienteExistente.telefone ? <p className="mt-0.5 text-(--color-ink-secondary)">{clienteExistente.telefone}</p> : null}
          {clienteExistente.website ? <p className="mt-0.5 text-(--color-ink-secondary)">{clienteExistente.website}</p> : null}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onAbrirExistente}
            className="rounded-xl bg-(--color-primary) px-4 py-2 text-xs font-semibold text-white hover:bg-(--color-primary-hover)"
          >
            Abrir cliente existente
          </button>
          <button
            type="button"
            onClick={onUsarEsteCliente}
            className="rounded-xl border border-(--color-line) px-4 py-2 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)"
          >
            Usar este cliente
          </button>
          <button type="button" onClick={onCancelar} className="text-xs font-medium text-(--color-ink-secondary) hover:underline">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
