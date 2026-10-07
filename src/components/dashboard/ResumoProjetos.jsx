// "Projetos em andamento" — clique abre o painel panorâmico da Fase 2E
// (?projeto=<id>, mesmo deep-link de Clientes/Projetos). Projetos atrasados
// já aparecem no painel de atenção — aqui o chip de prazo só reforça o
// contexto, sem duplicar um widget gigante só de atrasos.
import { Link } from 'react-router-dom'
import { FolderKanban } from 'lucide-react'
import { obterProjetosResumo } from '../../lib/dashboard/DashboardService'
import { formatarDataSegura } from '../../lib/helpers'
import SecaoCard from './SecaoCard'
import { useSecaoDados } from './useSecaoDados'

const ESTILO_SITUACAO = {
  atrasado: 'bg-(--color-danger)/10 text-(--color-danger)',
  proximo: 'bg-amber-400/10 text-amber-600',
  normal: 'bg-(--color-green-light)/15 text-(--color-green)',
  sem_prazo: 'bg-(--color-line)/40 text-(--color-ink-secondary)',
  encerrado: 'bg-(--color-line)/40 text-(--color-ink-secondary)',
}
const LABEL_SITUACAO = { atrasado: 'Atrasado', proximo: 'Prazo próximo', normal: 'No prazo', sem_prazo: 'Sem prazo', encerrado: 'Encerrado' }

export default function ResumoProjetos({ refreshKey }) {
  const { dados, carregando, erro } = useSecaoDados(obterProjetosResumo, refreshKey)
  const projetos = dados || []

  return (
    <SecaoCard
      titulo="Projetos em andamento"
      icon={FolderKanban}
      carregando={carregando}
      erro={erro}
      vazio={!carregando && projetos.length === 0}
      mensagemVazia="Nenhum projeto ativo agora."
    >
      <ul className="space-y-1.5">
        {projetos.map((projeto) => (
          <li key={projeto.id}>
            <Link to={projeto.link} className="flex items-center gap-2 rounded-xl border border-(--color-line) px-3 py-2 text-xs hover:bg-(--color-canvas)">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-(--color-ink)">{projeto.nome}</p>
                <p className="truncate text-(--color-ink-secondary)">
                  {projeto.cliente || 'Cliente'} · {projeto.statusLabel}
                  {projeto.prazoPrevisto ? ` · Prazo: ${formatarDataSegura(projeto.prazoPrevisto)}` : ''}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ESTILO_SITUACAO[projeto.situacaoPrazo]}`}>
                {LABEL_SITUACAO[projeto.situacaoPrazo]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SecaoCard>
  )
}
