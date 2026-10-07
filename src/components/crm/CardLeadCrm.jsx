// Card de lead no Kanban do CRM — item 8 do planejamento da Fase 2C.
import { Phone, Clock, AlertTriangle } from 'lucide-react'
import { PROXIMA_ACAO_TIPOS } from '../../lib/crm/LeadsService'

const COR_PRIORIDADE = {
  baixa: 'text-(--color-ink-secondary) bg-(--color-canvas)',
  media: 'text-(--color-status-inicio) bg-(--color-status-inicio-bg)',
  alta: 'text-(--color-danger) bg-(--color-status-problema-bg)',
}

function formatarProximaAcao(lead) {
  if (!lead.proxima_acao_tipo) return null
  const label = PROXIMA_ACAO_TIPOS.find((t) => t.valor === lead.proxima_acao_tipo)?.label || lead.proxima_acao_tipo
  if (!lead.proxima_acao_data) return label
  const data = new Date(lead.proxima_acao_data)
  const hoje = new Date()
  const mesmodia = data.toDateString() === hoje.toDateString()
  const dataFormatada = mesmodia
    ? `hoje ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return `${label} — ${dataFormatada}`
}

export default function CardLeadCrm({ lead, arrastavel = true, onAbrir, onDragStart, onDragEnd }) {
  const proximaAcao = formatarProximaAcao(lead)

  return (
    <div
      draggable={arrastavel}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', lead.id)
        onDragStart?.(lead)
      }}
      onDragEnd={onDragEnd}
      onClick={() => onAbrir?.(lead)}
      className="cursor-grab rounded-xl border border-(--color-line) bg-(--color-surface) p-3 text-left shadow-sm transition hover:border-(--color-primary-soft) active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-display text-sm font-semibold leading-tight text-(--color-ink)">{lead.nome_empresa}</h4>
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${COR_PRIORIDADE[lead.prioridade] || COR_PRIORIDADE.media}`}>
          {lead.prioridade === 'alta' ? 'Alta' : lead.prioridade === 'baixa' ? 'Baixa' : 'Média'}
        </span>
      </div>

      <p className="mt-0.5 text-xs text-(--color-ink-secondary)">{[lead.categoria, lead.cidade].filter(Boolean).join(' · ') || '—'}</p>

      {lead.duplicateWarning ? (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-(--color-danger)">
          <AlertTriangle size={11} />
          Revisar
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between text-[11px] text-(--color-ink-secondary)">
        <span className="flex items-center gap-1">
          <Phone size={11} />
          {lead.telefone || 'sem telefone'}
        </span>
      </div>

      {proximaAcao ? (
        <div className="mt-2 flex items-center gap-1 rounded-lg bg-(--color-canvas) px-2 py-1 text-[11px] text-(--color-ink)">
          <Clock size={11} className="shrink-0" />
          <span className="truncate">{proximaAcao}</span>
        </div>
      ) : null}
    </div>
  )
}
