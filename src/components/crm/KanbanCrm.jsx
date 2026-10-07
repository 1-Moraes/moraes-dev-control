// Kanban do CRM — item 8 do planejamento da Fase 2C. HTML5 Drag and Drop
// nativo (sem biblioteca nova, como pedido no item 7) — não existia um
// Kanban de verdade já implementado neste repositório para reaproveitar
// (só a referência textual ao do projeto original da GA, não disponível
// aqui), então o drag-and-drop abaixo foi escrito do zero, no mesmo
// espírito simples do pedido.
import { useState } from 'react'
import { STATUS_PIPELINE } from '../../lib/crm/LeadsService'
import CardLeadCrm from './CardLeadCrm'

export default function KanbanCrm({ leads, onAbrirLead, onMoverStatus }) {
  const [arrastando, setArrastando] = useState(null) // id do lead em arraste
  const [colunaAlvo, setColunaAlvo] = useState(null) // status sob o cursor (feedback visual)

  function leadsDoStatus(status) {
    return leads.filter((l) => l.status === status)
  }

  function soltarEm(status) {
    setColunaAlvo(null)
    if (!arrastando) return
    const lead = leads.find((l) => l.id === arrastando)
    setArrastando(null)
    if (!lead || lead.status === status) return
    onMoverStatus(lead, status)
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto pb-2">
      {STATUS_PIPELINE.map(({ valor, label }) => {
        const leadsColuna = leadsDoStatus(valor)
        return (
          <div
            key={valor}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (colunaAlvo !== valor) setColunaAlvo(valor)
            }}
            onDragLeave={() => setColunaAlvo((atual) => (atual === valor ? null : atual))}
            onDrop={(e) => {
              e.preventDefault()
              soltarEm(valor)
            }}
            className={`flex h-full w-64 shrink-0 flex-col rounded-2xl border bg-(--color-kanban) transition ${
              colunaAlvo === valor ? 'border-(--color-primary)' : 'border-(--color-line)'
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-(--color-line) px-3 py-2.5">
              <h3 className="text-xs font-semibold text-(--color-ink)">{label}</h3>
              <span className="rounded-full bg-(--color-surface) px-1.5 py-0.5 text-[10px] font-semibold text-(--color-ink-secondary)">
                {leadsColuna.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {leadsColuna.map((lead) => (
                <CardLeadCrm
                  key={lead.id}
                  lead={lead}
                  onAbrir={onAbrirLead}
                  onDragStart={(l) => setArrastando(l.id)}
                  onDragEnd={() => {
                    setArrastando(null)
                    setColunaAlvo(null)
                  }}
                />
              ))}
              {leadsColuna.length === 0 ? (
                <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-(--color-line) text-[11px] text-(--color-ink-secondary)">
                  Nenhum lead
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
