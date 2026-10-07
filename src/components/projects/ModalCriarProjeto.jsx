// Modal [+ Criar projeto] — itens 16, 17, 23 do planejamento da Fase 2D.
// Cliente já vem preenchido quando aberto a partir do drawer do cliente.
// Proteção simples contra double-submit (botão loading/disabled) — sem
// deduplicação agressiva, já que dois projetos reais diferentes podem
// nascer de dois cliques legítimos.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { PRIORIDADES_PROJETO, listarServicos } from '../../lib/projects/ProjectsService'

const VAZIO = {
  nome: '',
  service_id: '',
  prioridade: 'media',
  responsavel_id: '',
  data_inicio: '',
  prazo_previsto: '',
  valor_contratado: '',
  descricao: '',
  observacoes: '',
}

export default function ModalCriarProjeto({ aberto, cliente, equipe = [], onCancelar, onConfirmar }) {
  const [dados, setDados] = useState(VAZIO)
  const [servicos, setServicos] = useState([])
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    let cancelado = false
    listarServicos()
      .then((s) => {
        if (!cancelado) setServicos(s)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [aberto])

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
    if (enviando) return
    setEnviando(true)
    try {
      await onConfirmar({
        ...dados,
        valor_contratado: dados.valor_contratado ? Number(dados.valor_contratado.replace(',', '.')) : null,
        service_id: dados.service_id || null,
        responsavel_id: dados.responsavel_id || null,
      })
      setDados(VAZIO)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onCancelar} />
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-(--color-surface) p-5 shadow-xl">
        <h2 className="font-display text-sm font-semibold text-(--color-ink)">Criar projeto</h2>
        <p className="mt-1 text-xs text-(--color-ink-secondary)">Cliente: {cliente?.nome_empresa}</p>

        <div className="mt-4 space-y-3">
          {campo('nome', 'Nome do projeto *')}

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Tipo de serviço</label>
            <select
              value={dados.service_id}
              onChange={(e) => setDados((d) => ({ ...d, service_id: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none"
            >
              <option value="">—</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Prioridade</label>
              <select
                value={dados.prioridade}
                onChange={(e) => setDados((d) => ({ ...d, prioridade: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none"
              >
                {PRIORIDADES_PROJETO.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Responsável</label>
              <select
                value={dados.responsavel_id}
                onChange={(e) => setDados((d) => ({ ...d, responsavel_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none"
              >
                <option value="">Eu</option>
                {equipe.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {campo('data_inicio', 'Data de início', { type: 'date' })}
            {campo('prazo_previsto', 'Prazo previsto', { type: 'date' })}
          </div>

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Valor contratado (opcional)</label>
            <input
              value={dados.valor_contratado}
              onChange={(e) => setDados((d) => ({ ...d, valor_contratado: e.target.value }))}
              placeholder="Ex.: 2300,00"
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Descrição/escopo resumido</label>
            <textarea
              value={dados.descricao}
              onChange={(e) => setDados((d) => ({ ...d, descricao: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Observações</label>
            <textarea
              value={dados.observacoes}
              onChange={(e) => setDados((d) => ({ ...d, observacoes: e.target.value }))}
              rows={2}
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
            disabled={enviando || !dados.nome.trim()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-(--color-primary) px-4 py-2 text-xs font-semibold text-white hover:bg-(--color-primary-hover) disabled:opacity-60"
          >
            {enviando ? <Loader2 size={14} className="animate-spin" /> : null}
            {enviando ? 'Criando...' : 'Criar projeto'}
          </button>
        </div>
      </div>
    </div>
  )
}
