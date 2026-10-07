// Kanban de Projetos — itens 18-21 do planejamento da Fase 2E. Drag-and-
// drop nativo (HTML5), sem biblioteca nova. Pausado/Cancelado aparecem
// como colunas à parte, à direita, sem quebrar a leitura do fluxo
// principal (item 22).
import { useState } from 'react'
import { ETAPAS_PROJETO } from '../../lib/projects/ProjectsService'
import ChipPrazo from './ChipPrazo'

const COLUNAS_COMPLEMENTARES = [
  { valor: 'pausado', label: 'Pausado' },
  { valor: 'cancelado', label: 'Cancelado' },
]

function CardProjeto({ projeto, onAbrir, arrastavel, onDragStart }) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={arrastavel}
      onDragStart={(e) => onDragStart(e, projeto)}
      onClick={() => onAbrir(projeto)}
      onKeyDown={(e) => e.key === 'Enter' && onAbrir(projeto)}
      className="cursor-pointer rounded-xl border border-(--color-line) bg-(--color-surface) p-2.5 text-xs shadow-sm hover:border-(--color-primary)/50"
    >
      <p className="font-semibold text-(--color-ink)">{projeto.nome}</p>
      <p className="mt-0.5 truncate text-(--color-ink-secondary)">{projeto.cliente?.nome_empresa || '—'}</p>
      <p className="mt-0.5 text-[10px] text-(--color-ink-secondary)">{projeto.servico?.nome || 'Sem serviço'}</p>
      <div className="mt-1.5 flex items-center justify-between">
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            projeto.prioridade === 'alta'
              ? 'bg-(--color-danger)/10 text-(--color-danger)'
              : projeto.prioridade === 'media'
                ? 'bg-amber-400/10 text-amber-600'
                : 'bg-(--color-line)/40 text-(--color-ink-secondary)'
          }`}
        >
          {projeto.prioridade}
        </span>
        <span className="truncate text-[10px] text-(--color-ink-secondary)">{projeto.responsavel?.nome || '—'}</span>
      </div>
      {projeto.prazo_previsto ? <ChipPrazo prazoPrevisto={projeto.prazo_previsto} status={projeto.status} className="mt-1.5 inline-block" /> : null}
    </div>
  )
}

export default function KanbanProjetos({ projetos, onAbrirProjeto, onMoverEtapa }) {
  const [arrastando, setArrastando] = useState(null)
  const [colunaSobreposta, setColunaSobreposta] = useState(null)

  const colunas = [...ETAPAS_PROJETO.filter((e) => e.valor !== 'finalizado'), { valor: 'finalizado', label: 'Finalizado' }, ...COLUNAS_COMPLEMENTARES]

  function porColuna(valor) {
    return projetos.filter((p) => p.status === valor)
  }

  function aoSoltar(e, valorColuna) {
    e.preventDefault()
    setColunaSobreposta(null)
    if (arrastando && arrastando.status !== valorColuna) {
      onMoverEtapa(arrastando, valorColuna)
    }
    setArrastando(null)
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto pb-2">
      {colunas.map((coluna) => {
        const itens = porColuna(coluna.valor)
        const complementar = coluna.valor === 'pausado' || coluna.valor === 'cancelado'
        return (
          <div
            key={coluna.valor}
            onDragOver={(e) => {
              e.preventDefault()
              setColunaSobreposta(coluna.valor)
            }}
            onDragLeave={() => setColunaSobreposta((c) => (c === coluna.valor ? null : c))}
            onDrop={(e) => aoSoltar(e, coluna.valor)}
            className={`flex w-60 shrink-0 flex-col rounded-2xl border p-2 ${
              complementar ? 'border-dashed border-(--color-line) bg-(--color-canvas)/50' : 'border-(--color-line) bg-(--color-canvas)'
            } ${colunaSobreposta === coluna.valor ? 'ring-2 ring-(--color-primary)/40' : ''}`}
          >
            <div className="flex items-center justify-between px-1 py-1">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-(--color-ink-secondary)">{coluna.label}</h3>
              <span className="text-[10px] text-(--color-ink-secondary)">{itens.length}</span>
            </div>
            <div className="mt-1 flex-1 space-y-2 overflow-y-auto">
              {itens.map((p) => (
                <CardProjeto key={p.id} projeto={p} onAbrir={onAbrirProjeto} arrastavel onDragStart={(e, proj) => setArrastando(proj)} />
              ))}
              {itens.length === 0 ? <p className="px-1 py-4 text-center text-[11px] text-(--color-ink-secondary)">Nenhum projeto.</p> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
