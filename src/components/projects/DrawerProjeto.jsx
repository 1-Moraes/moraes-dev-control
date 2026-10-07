// Drawer de detalhe inicial do projeto — item 21 do planejamento da Fase
// 2D. Só a primeira versão: resumo, descrição, cliente, origem. A gestão
// operacional completa (Kanban, tarefas, briefing) é Fase 2E — não
// implementada aqui, por pedido explícito.
import { useEffect, useState } from 'react'
import { X, Loader2, ExternalLink } from 'lucide-react'
import { listarAtividadesProjeto } from '../../lib/projects/ProjectsService'

function Campo({ label, valor }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">{label}</dt>
      <dd className="mt-0.5 text-sm text-(--color-ink)">{valor || '—'}</dd>
    </div>
  )
}

function formatarMoeda(valor) {
  if (valor === null || valor === undefined) return null
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function DrawerProjeto({ projeto, onFechar, onAbrirCliente, onVerLead }) {
  if (!projeto) return null
  return <DrawerProjetoConteudo key={projeto.id} projeto={projeto} onFechar={onFechar} onAbrirCliente={onAbrirCliente} onVerLead={onVerLead} />
}

function DrawerProjetoConteudo({ projeto, onFechar, onAbrirCliente, onVerLead }) {
  const [atividades, setAtividades] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let cancelado = false
    listarAtividadesProjeto(projeto.id)
      .then((a) => {
        if (!cancelado) setAtividades(a)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [projeto.id])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onFechar} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-(--color-surface) p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-(--color-ink)">{projeto.nome}</h2>
            <p className="text-xs text-(--color-ink-secondary)">{projeto.servico?.nome || 'Sem tipo de serviço definido'}</p>
          </div>
          <button type="button" onClick={onFechar} className="shrink-0 rounded-lg p-1.5 text-(--color-ink-secondary) hover:bg-(--color-canvas)">
            <X size={18} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onAbrirCliente?.(projeto.client_id)}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-(--color-line) px-3 py-2 text-xs font-semibold text-(--color-primary) hover:bg-(--color-canvas)"
        >
          <ExternalLink size={13} /> Abrir cliente ({projeto.cliente?.nome_empresa})
        </button>

        {projeto.origin_lead_id ? (
          <button
            type="button"
            onClick={() => onVerLead?.(projeto.origin_lead_id)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-(--color-line) px-3 py-2 text-xs font-semibold text-(--color-primary) hover:bg-(--color-canvas)"
          >
            <ExternalLink size={13} /> Ver oportunidade original
          </button>
        ) : null}

        <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-(--color-ink-secondary)">Resumo</h3>
        <dl className="mt-3 space-y-3">
          <Campo label="Status" valor={projeto.status} />
          <Campo label="Prioridade" valor={projeto.prioridade} />
          <Campo label="Responsável" valor={projeto.responsavel?.nome} />
          <Campo label="Início" valor={projeto.data_inicio ? new Date(projeto.data_inicio).toLocaleDateString('pt-BR') : null} />
          <Campo label="Prazo previsto" valor={projeto.prazo_previsto ? new Date(projeto.prazo_previsto).toLocaleDateString('pt-BR') : null} />
          <Campo label="Valor contratado" valor={formatarMoeda(projeto.valor_contratado)} />
        </dl>

        <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-(--color-ink-secondary)">Descrição</h3>
        <dl className="mt-3 space-y-3">
          <Campo label="Escopo resumido" valor={projeto.descricao} />
          <Campo label="Observações" valor={projeto.observacoes} />
        </dl>

        <div className="mt-6 rounded-xl border border-dashed border-(--color-line) bg-(--color-canvas) p-3 text-center text-xs text-(--color-ink-secondary)">
          Gestão detalhada do projeto será disponibilizada na próxima etapa.
        </div>

        <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-(--color-ink-secondary)">Atividades</h3>
        <div className="mt-3 space-y-2 border-l border-(--color-line) pl-3">
          {carregando ? (
            <div className="flex items-center gap-2 text-xs text-(--color-ink-secondary)">
              <Loader2 size={13} className="animate-spin" /> Carregando...
            </div>
          ) : (
            atividades.map((a) => (
              <div key={a.id} className="relative text-xs">
                <span className="absolute -left-[15px] top-1 h-2 w-2 rounded-full bg-(--color-primary)" />
                <p className="text-(--color-ink)">{a.descricao}</p>
                <p className="text-[10px] text-(--color-ink-secondary)">
                  {a.autor?.nome || 'Equipe'} · {new Date(a.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ))
          )}
          {!carregando && atividades.length === 0 ? <p className="text-xs text-(--color-ink-secondary)">Nenhuma atividade registrada.</p> : null}
        </div>
      </div>
    </div>
  )
}
