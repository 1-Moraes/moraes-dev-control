// "Tarefas" — resumo agregado de project_tasks (reaproveita a tabela da
// Fase 2E, nenhum sistema de tarefas novo). Mostra contagem por status +
// lista curta das atrasadas, cada uma linkando pro projeto dela.
import { Link } from 'react-router-dom'
import { CheckSquare } from 'lucide-react'
import { obterTarefasResumo } from '../../lib/dashboard/DashboardService'
import { formatarDataSegura } from '../../lib/helpers'
import SecaoCard from './SecaoCard'
import { useSecaoDados } from './useSecaoDados'

export default function ResumoTarefas({ refreshKey }) {
  const { dados, carregando, erro } = useSecaoDados(obterTarefasResumo, refreshKey)
  const resumo = dados || { total: 0, porStatus: [], atrasadas: [] }

  return (
    <SecaoCard
      titulo="Tarefas"
      icon={CheckSquare}
      carregando={carregando}
      erro={erro}
      vazio={!carregando && resumo.total === 0}
      mensagemVazia="Nenhuma tarefa criada em nenhum projeto ainda."
    >
      <div className="flex flex-wrap gap-2 text-[11px]">
        {resumo.porStatus.map((s) => (
          <span key={s.valor} className="rounded-full border border-(--color-line) px-2.5 py-1 text-(--color-ink-secondary)">
            {s.label}: <span className="font-semibold text-(--color-ink)">{s.quantidade}</span>
          </span>
        ))}
      </div>

      {resumo.atrasadas.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-(--color-line) pt-3">
          {resumo.atrasadas.slice(0, 5).map((t) => {
            const conteudo = (
              <div className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 text-xs hover:bg-(--color-canvas)">
                <span className="min-w-0 flex-1 truncate text-(--color-ink)">{t.titulo}</span>
                <span className="shrink-0 text-(--color-danger)">{formatarDataSegura(t.prazo)}</span>
              </div>
            )
            return <li key={t.id}>{t.link ? <Link to={t.link}>{conteudo}</Link> : conteudo}</li>
          })}
        </ul>
      ) : null}
    </SecaoCard>
  )
}
