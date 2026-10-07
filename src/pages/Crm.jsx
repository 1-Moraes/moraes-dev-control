// CRM / Leads — Fase 2C do planejamento. Transforma a página (antes um
// placeholder, Fase 1) em uma tela operacional real: Kanban (padrão) e
// Tabela, ambos lendo/escrevendo leads persistidos no Supabase via
// LeadsService — nunca localStorage (o localStorage do Radar continua só
// para "candidatos selecionados", ver Prospeccao.jsx).
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { KanbanSquare, Table2, Loader2, AlertTriangle, Users } from 'lucide-react'
import { listarLeads, atualizarStatus } from '../lib/crm/LeadsService'
import KanbanCrm from '../components/crm/KanbanCrm'
import TabelaCrm from '../components/crm/TabelaCrm'
import DrawerLead from '../components/crm/DrawerLead'
import ModalPerdido from '../components/crm/ModalPerdido'

export default function Crm() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [visualizacao, setVisualizacao] = useState('kanban')
  const [leads, setLeads] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [leadAbertoId, setLeadAbertoId] = useState(null)
  const [leadParaPerder, setLeadParaPerder] = useState(null)

  // Padrão igual ao de AuthContext.jsx (getSession().then(...)): nenhum
  // setState roda de forma síncrona no corpo do effect — tudo acontece
  // dentro de callbacks .then()/.catch()/.finally() da própria promise,
  // o que evita o encadeamento de renders que a regra
  // react-hooks/set-state-in-effect sinaliza. `carregando`/`erro` já
  // nascem com os valores corretos via useState, sem precisar resetá-los
  // de novo aqui.
  const carregar = useCallback(() => {
    return listarLeads()
      .then((dados) => setLeads(dados))
      .catch((e) => setErro(e?.message || 'Não foi possível carregar os leads.'))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Deep-link vindo do Radar ([Abrir no CRM] / [Abrir existente]) —
  // ?lead=<id> abre o drawer direto nesse lead assim que a lista carregar.
  // Sincroniza estado local a partir de um sistema externo (a URL) — é
  // exatamente o caso que useEffect existe para resolver (ver
  // MapaResultados.jsx para o mesmo padrão já aceito neste projeto); sem
  // alternativa limpa sem effect aqui, então a regra é suprimida
  // deliberadamente nas duas linhas que de fato mexem em estado.
  useEffect(() => {
    const idParaAbrir = searchParams.get('lead')
    if (idParaAbrir && leads.some((l) => l.id === idParaAbrir)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o drawer aberto a partir da URL (?lead=)
      setLeadAbertoId(idParaAbrir)
      const novos = new URLSearchParams(searchParams)
      novos.delete('lead')
      setSearchParams(novos, { replace: true })
    }
  }, [leads, searchParams, setSearchParams])

  async function moverStatus(lead, novoStatus) {
    if (novoStatus === 'perdido') {
      setLeadParaPerder(lead)
      return
    }
    await aplicarStatus(lead, novoStatus)
  }

  async function aplicarStatus(lead, novoStatus, motivoPerda) {
    try {
      const atualizado = await atualizarStatus(lead.id, novoStatus, { motivoPerda })
      setLeads((ls) => ls.map((l) => (l.id === atualizado.id ? atualizado : l)))
    } catch (e) {
      setErro(e?.message || 'Não foi possível atualizar o status do lead.')
    }
  }

  const leadAberto = leads.find((l) => l.id === leadAbertoId) || null

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-(--color-ink)">CRM / Leads</h1>
          <p className="mt-0.5 text-sm text-(--color-ink-secondary)">
            Pipeline comercial — oportunidades selecionadas no Radar de Prospecção, da descoberta ao fechamento.
          </p>
        </div>
        <div className="flex rounded-xl border border-(--color-line) p-1">
          <button
            type="button"
            onClick={() => setVisualizacao('kanban')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              visualizacao === 'kanban' ? 'bg-(--color-primary) text-white' : 'text-(--color-ink-secondary) hover:bg-(--color-canvas)'
            }`}
          >
            <KanbanSquare size={14} /> Kanban
          </button>
          <button
            type="button"
            onClick={() => setVisualizacao('tabela')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              visualizacao === 'tabela' ? 'bg-(--color-primary) text-white' : 'text-(--color-ink-secondary) hover:bg-(--color-canvas)'
            }`}
          >
            <Table2 size={14} /> Tabela
          </button>
        </div>
      </div>

      {erro ? (
        <div className="flex items-center gap-2 rounded-xl border border-(--color-danger)/30 bg-(--color-status-problema-bg) px-3 py-2 text-xs text-(--color-ink)">
          <AlertTriangle size={14} className="shrink-0 text-(--color-danger)" />
          {erro}
        </div>
      ) : null}

      {carregando ? (
        <div className="flex flex-1 items-center justify-center text-(--color-ink-secondary)">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-(--color-line) bg-(--color-surface) p-10 text-center">
          <Users size={28} className="text-(--color-ink-secondary)" />
          <div>
            <p className="font-display text-sm font-semibold text-(--color-ink)">Nenhum lead no CRM ainda.</p>
            <p className="mt-1 max-w-sm text-xs text-(--color-ink-secondary)">
              Selecione oportunidades no Radar de Prospecção para começar.
            </p>
          </div>
          <Link
            to="/dashboard/prospeccao"
            className="rounded-xl bg-(--color-primary) px-4 py-2 text-xs font-semibold text-white hover:bg-(--color-primary-hover)"
          >
            Ir para Prospecção
          </Link>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          {visualizacao === 'kanban' ? (
            <KanbanCrm leads={leads} onAbrirLead={(l) => setLeadAbertoId(l.id)} onMoverStatus={moverStatus} />
          ) : (
            <TabelaCrm leads={leads} onAbrirLead={(l) => setLeadAbertoId(l.id)} />
          )}
        </div>
      )}

      <DrawerLead
        lead={leadAberto}
        onFechar={() => setLeadAbertoId(null)}
        onMoverStatus={moverStatus}
        onLeadAtualizado={(atualizado) => setLeads((ls) => ls.map((l) => (l.id === atualizado.id ? atualizado : l)))}
      />

      <ModalPerdido
        lead={leadParaPerder}
        onCancelar={() => setLeadParaPerder(null)}
        onConfirmar={async (motivo) => {
          const lead = leadParaPerder
          setLeadParaPerder(null)
          await aplicarStatus(lead, 'perdido', motivo)
        }}
      />
    </div>
  )
}
