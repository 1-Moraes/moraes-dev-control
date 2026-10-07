// "Próximas ações" — leads com proxima_acao_* preenchida, em ordem
// cronológica, com ações rápidas (Abrir lead / WhatsApp / Ligar) a partir
// dos campos reais do CRM — nada inventado, nenhuma ação nova criada aqui.
import { Link } from 'react-router-dom'
import { CalendarClock, MessageCircle, Phone, ArrowRightCircle } from 'lucide-react'
import { obterProximasAcoes } from '../../lib/dashboard/DashboardService'
import { formatarDataHora } from '../../lib/helpers'
import SecaoCard from './SecaoCard'
import { useSecaoDados } from './useSecaoDados'

function linkWhatsapp(telefone) {
  if (!telefone) return null
  const digitos = telefone.replace(/\D/g, '')
  if (!digitos) return null
  return `https://wa.me/55${digitos.replace(/^55/, '')}`
}

export default function ProximasAcoes({ refreshKey }) {
  const { dados, carregando, erro } = useSecaoDados(obterProximasAcoes, refreshKey)
  const acoes = dados || []

  return (
    <SecaoCard
      titulo="Próximas ações"
      icon={CalendarClock}
      carregando={carregando}
      erro={erro}
      vazio={!carregando && acoes.length === 0}
      mensagemVazia="Nenhuma próxima ação agendada nos leads."
    >
      <ul className="space-y-1.5">
        {acoes.map((acao) => {
          const whatsapp = linkWhatsapp(acao.telefone)
          return (
            <li key={acao.id} className="flex items-center gap-2 rounded-xl border border-(--color-line) px-3 py-2 text-xs">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-(--color-ink)">{acao.nome}</p>
                <p className="truncate text-(--color-ink-secondary)">
                  {acao.descricao || acao.tipo || 'Ação a definir'} · {formatarDataHora(acao.data)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {whatsapp ? (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-(--color-green) hover:bg-(--color-green-light)/15"
                    title="WhatsApp"
                  >
                    <MessageCircle size={14} />
                  </a>
                ) : null}
                {acao.telefone ? (
                  <a
                    href={`tel:${acao.telefone.replace(/\D/g, '')}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-(--color-ink-secondary) hover:bg-(--color-canvas)"
                    title="Ligar"
                  >
                    <Phone size={14} />
                  </a>
                ) : null}
                <Link
                  to={acao.link}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-(--color-primary) hover:bg-(--color-primary-bg)"
                  title="Abrir lead"
                >
                  <ArrowRightCircle size={15} />
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </SecaoCard>
  )
}
