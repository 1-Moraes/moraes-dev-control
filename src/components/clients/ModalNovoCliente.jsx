// Cadastro manual de cliente — item 13 do planejamento da Fase 2D. Nem
// todo cliente vem do Radar (indicação, conhecido, contato direto).
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

const VAZIO = { nome_empresa: '', segmento: '', telefone: '', email: '', website: '', cidade: '', estado: '', observacoes: '' }

export default function ModalNovoCliente({ aberto, onCancelar, onConfirmar }) {
  const [dados, setDados] = useState(VAZIO)
  const [enviando, setEnviando] = useState(false)

  if (!aberto) return null

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
      setDados(VAZIO)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onCancelar} />
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-(--color-surface) p-5 shadow-xl">
        <h2 className="font-display text-sm font-semibold text-(--color-ink)">Novo cliente</h2>
        <p className="mt-1 text-xs text-(--color-ink-secondary)">Cadastro direto — indicação, contato direto, parceria.</p>

        <div className="mt-4 space-y-3">
          {campo('nome_empresa', 'Nome / Empresa *')}
          {campo('segmento', 'Segmento')}
          <div className="grid grid-cols-2 gap-2">
            {campo('telefone', 'Telefone')}
            {campo('email', 'E-mail', { type: 'email' })}
          </div>
          {campo('website', 'Website')}
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
            {enviando ? 'Salvando...' : 'Criar cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}
