// Subpainel de Tarefas — itens 24-27 do planejamento da Fase 2E. Abre por
// cima do painel panorâmico (modal secundário) para não transformar a
// ficha principal numa tela infinita. Suporta subtarefas simples (um
// nível, via parent_task_id).
import { useState } from 'react'
import { X, Plus, Loader2, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { STATUS_TAREFA, PRIORIDADES_PROJETO, criarTarefa, atualizarTarefa, excluirTarefa } from '../../lib/projects/ProjectsService'

function LinhaTarefa({ tarefa, subtarefas, equipe, onMudar, onExcluir, onCriarSubtarefa }) {
  const [expandida, setExpandida] = useState(true)
  const [novaSubtarefa, setNovaSubtarefa] = useState('')
  const [enviandoSub, setEnviandoSub] = useState(false)
  const concluida = tarefa.status === 'concluida'

  async function enviarSubtarefa() {
    if (!novaSubtarefa.trim() || enviandoSub) return
    setEnviandoSub(true)
    try {
      await onCriarSubtarefa(tarefa.id, novaSubtarefa.trim())
      setNovaSubtarefa('')
    } finally {
      setEnviandoSub(false)
    }
  }

  return (
    <div className="rounded-xl border border-(--color-line) bg-(--color-surface)">
      <div className="flex items-start gap-2 p-2.5">
        {subtarefas.length > 0 ? (
          <button type="button" onClick={() => setExpandida((e) => !e)} className="mt-0.5 text-(--color-ink-secondary)">
            {expandida ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-[14px]" />
        )}
        <input
          type="checkbox"
          checked={concluida}
          onChange={(e) => onMudar(tarefa, { status: e.target.checked ? 'concluida' : 'a_fazer' })}
          className="mt-0.5 h-4 w-4 accent-(--color-primary)"
        />
        <div className="flex-1">
          <p className={`text-sm ${concluida ? 'text-(--color-ink-secondary) line-through' : 'text-(--color-ink)'}`}>{tarefa.titulo}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <select
              value={tarefa.status}
              onChange={(e) => onMudar(tarefa, { status: e.target.value })}
              className="rounded-md border border-(--color-line) bg-(--color-canvas) px-1.5 py-0.5 text-[10px] text-(--color-ink)"
            >
              {STATUS_TAREFA.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={tarefa.responsavel_id || ''}
              onChange={(e) => onMudar(tarefa, { responsavel_id: e.target.value || null })}
              className="rounded-md border border-(--color-line) bg-(--color-canvas) px-1.5 py-0.5 text-[10px] text-(--color-ink)"
            >
              <option value="">Sem responsável</option>
              {equipe.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
            {tarefa.prazo ? <span className="text-[10px] text-(--color-ink-secondary)">Prazo {new Date(tarefa.prazo).toLocaleDateString('pt-BR')}</span> : null}
          </div>
        </div>
        <button type="button" onClick={() => onExcluir(tarefa)} className="shrink-0 rounded-md p-1 text-(--color-ink-secondary) hover:bg-(--color-canvas) hover:text-(--color-danger)">
          <Trash2 size={13} />
        </button>
      </div>

      {expandida && subtarefas.length > 0 ? (
        <div className="space-y-1.5 border-t border-(--color-line) px-2.5 py-2 pl-8">
          {subtarefas.map((sub) => (
            <label key={sub.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={sub.status === 'concluida'}
                onChange={(e) => onMudar(sub, { status: e.target.checked ? 'concluida' : 'a_fazer' })}
                className="h-3.5 w-3.5 accent-(--color-primary)"
              />
              <span className={sub.status === 'concluida' ? 'text-(--color-ink-secondary) line-through' : 'text-(--color-ink)'}>{sub.titulo}</span>
            </label>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-1.5 border-t border-(--color-line) px-2.5 py-1.5 pl-8">
        <input
          value={novaSubtarefa}
          onChange={(e) => setNovaSubtarefa(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviarSubtarefa()}
          placeholder="+ subtarefa..."
          className="flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-(--color-ink) outline-none focus:border-(--color-line)"
        />
      </div>
    </div>
  )
}

export default function SubpainelTarefas({ aberto, tarefas, equipe, onFechar, onRecarregar, projectId }) {
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novaPrioridade, setNovaPrioridade] = useState('media')
  const [enviando, setEnviando] = useState(false)

  if (!aberto) return null

  const principais = tarefas.filter((t) => !t.parent_task_id)
  const porPai = tarefas.filter((t) => t.parent_task_id).reduce((acc, t) => {
    ;(acc[t.parent_task_id] ||= []).push(t)
    return acc
  }, {})

  async function criarPrincipal() {
    if (!novoTitulo.trim() || enviando) return
    setEnviando(true)
    try {
      await criarTarefa(projectId, { titulo: novoTitulo.trim(), prioridade: novaPrioridade })
      setNovoTitulo('')
      await onRecarregar()
    } finally {
      setEnviando(false)
    }
  }

  async function criarSubtarefa(parentId, titulo) {
    await criarTarefa(projectId, { titulo, parent_task_id: parentId })
    await onRecarregar()
  }

  async function mudar(tarefa, patch) {
    await atualizarTarefa(tarefa, patch)
    await onRecarregar()
  }

  async function excluir(tarefa) {
    await excluirTarefa(tarefa)
    await onRecarregar()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onFechar} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-(--color-surface) shadow-xl">
        <div className="flex items-center justify-between border-b border-(--color-line) px-4 py-3">
          <h2 className="font-display text-sm font-semibold text-(--color-ink)">Tarefas do projeto</h2>
          <button type="button" onClick={onFechar} className="rounded-lg p-1 text-(--color-ink-secondary) hover:bg-(--color-canvas)">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 border-b border-(--color-line) px-4 py-2.5">
          <input
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && criarPrincipal()}
            placeholder="Nova tarefa..."
            className="flex-1 rounded-lg border border-(--color-line) bg-(--color-canvas) px-2.5 py-1.5 text-xs text-(--color-ink) outline-none focus:border-(--color-primary)"
          />
          <select
            value={novaPrioridade}
            onChange={(e) => setNovaPrioridade(e.target.value)}
            className="rounded-lg border border-(--color-line) bg-(--color-canvas) px-1.5 py-1.5 text-xs text-(--color-ink)"
          >
            {PRIORIDADES_PROJETO.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={criarPrincipal}
            disabled={enviando || !novoTitulo.trim()}
            className="flex items-center justify-center rounded-lg bg-(--color-primary) px-2.5 py-1.5 text-white disabled:opacity-50"
          >
            {enviando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {principais.length === 0 ? (
            <p className="py-6 text-center text-xs text-(--color-ink-secondary)">Nenhuma tarefa criada.</p>
          ) : (
            principais.map((t) => (
              <LinhaTarefa
                key={t.id}
                tarefa={t}
                subtarefas={porPai[t.id] || []}
                equipe={equipe}
                onMudar={mudar}
                onExcluir={excluir}
                onCriarSubtarefa={criarSubtarefa}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
