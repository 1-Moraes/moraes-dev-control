// "Precisa da sua atenção" — feed priorizado (atrasado > hoje > próximo >
// informativo) de leads com próxima ação vencida, projetos atrasados e
// tarefas atrasadas. Cada item é clicável e leva direto ao registro, pelos
// MESMOS padrões de deep-link já usados no resto do app.
import { Link } from 'react-router-dom'
import { AlertCircle, Building2, FolderKanban, CheckSquare, ShieldCheck } from 'lucide-react'
import { obterItensAtencao } from '../../lib/dashboard/DashboardService'
import { formatarDataHora, formatarDataSegura } from '../../lib/helpers'
import SecaoCard from './SecaoCard'
import { useSecaoDados } from './useSecaoDados'

const ICONE_POR_TIPO = { lead: Building2, projeto: FolderKanban, tarefa: CheckSquare }

// Cor sinaliza severidade só na borda/selo do item — nunca pinta o card
// inteiro (regra explícita do planejamento, item "cuidado visual").
const ESTILO_POR_SEVERIDADE = {
  atrasado: 'border-(--color-danger)/40 text-(--color-danger)',
  hoje: 'border-amber-500/40 text-amber-600',
  proximo: 'border-amber-400/30 text-amber-600',
  informativo: 'border-(--color-line) text-(--color-ink-secondary)',
}

const LABEL_SEVERIDADE = { atrasado: 'Atrasado', hoje: 'Hoje', proximo: 'Em breve', informativo: 'Aviso' }

export default function PainelAtencao({ refreshKey }) {
  const { dados, carregando, erro } = useSecaoDados(obterItensAtencao, refreshKey)
  const itens = dados || []

  return (
    <SecaoCard
      titulo="Precisa da sua atenção"
      icon={AlertCircle}
      carregando={carregando}
      erro={erro}
      vazio={!carregando && itens.length === 0}
      mensagemVazia="Nada pendente agora — tudo em dia."
    >
      <ul className="space-y-1.5">
        {itens.slice(0, 8).map((item) => {
          const Icon = ICONE_POR_TIPO[item.tipo] || ShieldCheck
          const conteudo = (
            <div
              className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-xs hover:bg-(--color-canvas) ${ESTILO_POR_SEVERIDADE[item.severidade] || ''}`}
            >
              <Icon size={14} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-(--color-ink)">{item.titulo}</p>
                <p className="truncate text-(--color-ink-secondary)">{item.subtitulo}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide">{LABEL_SEVERIDADE[item.severidade]}</p>
                {item.data ? (
                  <p className="text-[10px] text-(--color-ink-secondary)">
                    {item.tipo === 'lead' ? formatarDataHora(item.data) : formatarDataSegura(item.data)}
                  </p>
                ) : null}
              </div>
            </div>
          )
          return (
            <li key={item.id}>
              {item.link ? <Link to={item.link}>{conteudo}</Link> : conteudo}
            </li>
          )
        })}
      </ul>
    </SecaoCard>
  )
}
