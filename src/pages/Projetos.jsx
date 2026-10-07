// Projetos — Fase 2D criou a listagem inicial; Fase 2E transforma em
// visão operacional: alternância Kanban/Tabela (item 18), painel
// panorâmico central no lugar do antigo drawer lateral (itens 4-17), e
// deep-link (?projeto=<id>) preservado.
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, AlertTriangle, FolderKanban, LayoutGrid, List as ListIcon } from 'lucide-react'
import { listarProjetos, listarMembrosEquipe, moverEtapaProjeto } from '../lib/projects/ProjectsService'
import TabelaProjetos from '../components/projects/TabelaProjetos'
import KanbanProjetos from '../components/projects/KanbanProjetos'
import PainelProjeto from '../components/projects/PainelProjeto'

const VISAO_SALVA_KEY = 'moraesdev.projetos.visao'

export default function Projetos() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [projetos, setProjetos] = useState([])
  const [equipe, setEquipe] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [projetoAbertoId, setProjetoAbertoId] = useState(null)
  const [visao, setVisao] = useState(() => {
    try {
      return localStorage.getItem(VISAO_SALVA_KEY) || 'kanban'
    } catch {
      return 'kanban'
    }
  })

  const carregar = useCallback(() => {
    return Promise.all([listarProjetos(), listarMembrosEquipe()])
      .then(([p, e]) => {
        setProjetos(p)
        setEquipe(e)
      })
      .catch((e) => setErro(e?.message || 'Não foi possível carregar os projetos.'))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Deep-link vindo de Clientes (?projeto=<id>) — mesmo padrão de Crm.jsx.
  useEffect(() => {
    const idParaAbrir = searchParams.get('projeto')
    if (idParaAbrir && projetos.some((p) => p.id === idParaAbrir)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o painel aberto a partir da URL (?projeto=)
      setProjetoAbertoId(idParaAbrir)
      const novos = new URLSearchParams(searchParams)
      novos.delete('projeto')
      setSearchParams(novos, { replace: true })
    }
  }, [projetos, searchParams, setSearchParams])

  function escolherVisao(nova) {
    setVisao(nova)
    try {
      localStorage.setItem(VISAO_SALVA_KEY, nova)
    } catch {
      // localStorage pode estar indisponível (modo privado); preferência só não persiste entre sessões.
    }
  }

  const projetoAberto = projetos.find((p) => p.id === projetoAbertoId) || null

  function atualizarProjetoNaLista(atualizado) {
    setProjetos((ps) => ps.map((p) => (p.id === atualizado.id ? atualizado : p)))
  }

  async function moverViaKanban(projeto, novoStatus) {
    try {
      const atualizado = await moverEtapaProjeto(projeto, novoStatus)
      atualizarProjetoNaLista(atualizado)
    } catch (e) {
      setErro(e?.message || 'Não foi possível mover o projeto.')
    }
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-(--color-ink)">Projetos</h1>
          <p className="mt-0.5 text-sm text-(--color-ink-secondary)">Serviços contratados que serão executados pela Moraes.Dev.</p>
        </div>
        <div className="flex rounded-xl border border-(--color-line) bg-(--color-surface) p-0.5">
          <button
            type="button"
            onClick={() => escolherVisao('kanban')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              visao === 'kanban' ? 'bg-(--color-primary) text-white' : 'text-(--color-ink-secondary)'
            }`}
          >
            <LayoutGrid size={13} /> Kanban
          </button>
          <button
            type="button"
            onClick={() => escolherVisao('tabela')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              visao === 'tabela' ? 'bg-(--color-primary) text-white' : 'text-(--color-ink-secondary)'
            }`}
          >
            <ListIcon size={13} /> Tabela
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
      ) : projetos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-(--color-line) bg-(--color-surface) p-10 text-center">
          <FolderKanban size={28} className="text-(--color-ink-secondary)" />
          <div>
            <p className="font-display text-sm font-semibold text-(--color-ink)">Nenhum projeto criado ainda.</p>
            <p className="mt-1 max-w-sm text-xs text-(--color-ink-secondary)">Crie um projeto a partir de um cliente.</p>
          </div>
          <Link
            to="/dashboard/clientes"
            className="rounded-xl bg-(--color-primary) px-4 py-2 text-xs font-semibold text-white hover:bg-(--color-primary-hover)"
          >
            Ver clientes
          </Link>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          {visao === 'kanban' ? (
            <KanbanProjetos projetos={projetos} onAbrirProjeto={(p) => setProjetoAbertoId(p.id)} onMoverEtapa={moverViaKanban} />
          ) : (
            <TabelaProjetos projetos={projetos} onAbrirProjeto={(p) => setProjetoAbertoId(p.id)} />
          )}
        </div>
      )}

      <PainelProjeto
        projeto={projetoAberto}
        equipe={equipe}
        onFechar={() => setProjetoAbertoId(null)}
        onAbrirCliente={(clientId) => navigate(`/dashboard/clientes?cliente=${clientId}`)}
        onVerLead={(leadId) => navigate(`/dashboard/crm?lead=${leadId}`)}
        onProjetoAtualizado={atualizarProjetoNaLista}
      />
    </div>
  )
}
