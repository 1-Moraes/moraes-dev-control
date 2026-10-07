// "Atividade recente" — feed mesclado de lead_activities + project_activities
// + audit_logs (ver obterAtividadeRecente), limitado a poucos eventos —
// não é uma timeline completa, é um resumo do que aconteceu há pouco.
import { Link } from 'react-router-dom'
import { History } from 'lucide-react'
import { obterAtividadeRecente } from '../../lib/dashboard/DashboardService'
import { formatarDataHora } from '../../lib/helpers'
import SecaoCard from './SecaoCard'
import { useSecaoDados } from './useSecaoDados'

export default function AtividadeRecente({ refreshKey }) {
  const { dados, carregando, erro } = useSecaoDados(obterAtividadeRecente, refreshKey)
  const eventos = dados || []

  return (
    <SecaoCard
      titulo="Atividade recente"
      icon={History}
      carregando={carregando}
      erro={erro}
      vazio={!carregando && eventos.length === 0}
      mensagemVazia="Nenhuma atividade registrada ainda."
    >
      <ul className="space-y-2.5">
        {eventos.map((evento) => {
          const texto = (
            <p className="text-xs text-(--color-ink)">
              <span className="font-semibold">{evento.autor}</span> · {evento.descricao}
              {evento.contexto ? <span className="text-(--color-ink-secondary)"> ({evento.contexto})</span> : null}
              <span className="ml-1 text-[10px] text-(--color-ink-secondary)">{formatarDataHora(evento.createdAt)}</span>
            </p>
          )
          return <li key={evento.id}>{evento.link ? <Link to={evento.link}>{texto}</Link> : texto}</li>
        })}
      </ul>
    </SecaoCard>
  )
}
