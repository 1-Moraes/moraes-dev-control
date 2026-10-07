// "Pipeline comercial" — contagens reais por estágio (Descoberto…
// Negociação), barras feitas só com CSS (sem lib de gráfico, como o
// planejamento permite). Ganho/Perdido aparecem como selos à parte — são
// estágios de SAÍDA do funil, não faz sentido barra proporcional ao lado
// dos estágios "em andamento". Sem taxa de conversão (seria enganosa com
// tão poucos dados reais ainda).
import { Filter } from 'lucide-react'
import { Link } from 'react-router-dom'
import { obterPipeline } from '../../lib/dashboard/DashboardService'
import SecaoCard from './SecaoCard'
import { useSecaoDados } from './useSecaoDados'

export default function ResumoPipeline({ refreshKey }) {
  const { dados, carregando, erro } = useSecaoDados(obterPipeline, refreshKey)
  const estagios = dados || []
  const emAndamento = estagios.filter((e) => e.valor !== 'ganho' && e.valor !== 'perdido')
  const fechados = estagios.filter((e) => e.valor === 'ganho' || e.valor === 'perdido')
  const maior = Math.max(1, ...emAndamento.map((e) => e.quantidade))

  return (
    <SecaoCard
      titulo="Pipeline comercial"
      icon={Filter}
      carregando={carregando}
      erro={erro}
      vazio={!carregando && estagios.every((e) => e.quantidade === 0)}
      mensagemVazia="Nenhum lead no funil ainda."
      className="lg:col-span-2"
    >
      <div className="space-y-1.5">
        {emAndamento.map((estagio) => (
          <Link
            key={estagio.valor}
            to={`/dashboard/crm`}
            className="flex items-center gap-2 text-xs hover:opacity-80"
          >
            <span className="w-28 shrink-0 truncate text-(--color-ink-secondary)">{estagio.label}</span>
            <span className="h-4 flex-1 overflow-hidden rounded-full bg-(--color-canvas)">
              <span
                className="block h-full rounded-full bg-(--color-primary)"
                style={{ width: `${Math.max(4, (estagio.quantidade / maior) * 100)}%` }}
              />
            </span>
            <span className="w-6 shrink-0 text-right font-semibold text-(--color-ink)">{estagio.quantidade}</span>
          </Link>
        ))}
      </div>
      <div className="mt-3 flex gap-2 border-t border-(--color-line) pt-3 text-xs">
        {fechados.map((estagio) => (
          <span
            key={estagio.valor}
            className={`rounded-full px-2.5 py-1 font-semibold ${
              estagio.valor === 'ganho' ? 'bg-(--color-green-light)/15 text-(--color-green)' : 'bg-(--color-danger)/10 text-(--color-danger)'
            }`}
          >
            {estagio.label}: {estagio.quantidade}
          </span>
        ))}
      </div>
    </SecaoCard>
  )
}
