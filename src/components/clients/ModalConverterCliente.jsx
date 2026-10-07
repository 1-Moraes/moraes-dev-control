// Modal de revisão antes de converter um lead GANHO em cliente — item 6 do
// planejamento da Fase 2D. Pré-preenche a partir do lead, mas permite
// revisar/editar antes de confirmar (nunca copia cegamente).
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function ModalConverterCliente({ lead, onCancelar, onConfirmar }) {
  const [dados, setDados] = useState(() => ({
    nome_empresa: lead?.nome_empresa || '',
    segmento: lead?.categoria || '',
    telefone: lead?.telefone || '',
    website: lead?.website || '',
    endereco: lead?.endereco || '',
    bairro: lead?.bairro || '',
    cidade: lead?.cidade || '',
    estado: lead?.estado || '',
    observacoes: lead?.observacoes || '',
  }))
  const [enviando, setEnviando] = useState(false)

  if (!lead) return null

  function campo(chave, label, props = {}) {
    return (
      <div>
        <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">{label}</label>
        <input
          value={dados[chave]}
          onChange={(e) => setDados((d) => ({ ...d, [chave]: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
          {...props}
        />
      </div>
    )
  }

  async function confirmar() {
    setEnviando(true)
    try {
      await onConfirmar(dados)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onCancelar} />
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-(--color-surface) p-5 shadow-xl">
        <h2 className="font-display text-sm font-semibold text-(--color-ink)">Converter lead em cliente</h2>
        <p className="mt-1 text-xs text-(--color-ink-secondary)">Revise os dados que serão aproveitados antes de confirmar.</p>

        <div className="mt-4 space-y-3">
          {campo('nome_empresa', 'Empresa')}
          {campo('segmento', 'Segmento')}
          {campo('telefone', 'Telefone')}
          {campo('website', 'Website')}
          {campo('endereco', 'Endereço')}
          <div className="grid grid-cols-2 gap-2">
            {campo('cidade', 'Cidade')}
            {campo('estado', 'Estado')}
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Observações</label>
            <textarea
              value={dados.observacoes}
              onChange={(e) => setDados((d) => ({ ...d, observacoes: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={enviando}
            className="flex-1 rounded-xl border border-(--color-line) px-4 py-2 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas) disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={enviando || !dados.nome_empresa.trim()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-(--color-primary) px-4 py-2 text-xs font-semibold text-white hover:bg-(--color-primary-hover) disabled:opacity-60"
          >
            {enviando ? <Loader2 size={14} className="animate-spin" /> : null}
            {enviando ? 'Convertendo...' : 'Confirmar conversão'}
          </button>
        </div>
      </div>
    </div>
  )
}
