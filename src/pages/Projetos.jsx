// Projetos — Fase 2D do planejamento. Transforma a página (antes um
// placeholder) em uma primeira versão funcional: lista/tabela de projetos
// persistidos, detalhe inicial e deep-link (?projeto=<id>). SEM Kanban
// completo — gestão operacional é Fase 2E, por pedido explícito.
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, AlertTriangle, FolderKanban } from 'lucide-react'
import { listarProjetos } from '../lib/projects/ProjectsService'
import TabelaProjetos from '../components/projects/TabelaProjetos'
import DrawerProjeto from '../components/projects/DrawerProjeto'

export default function Projetos() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [projetos, setProjetos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [projetoAbertoId, setProjetoAbertoId] = useState(null)

  const carregar = useCallback(() => {
    return listarProjetos()
      .then((dados) => setProjetos(dados))
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o drawer aberto a partir da URL (?projeto=)
      setProjetoAbertoId(idParaAbrir)
      const novos = new URLSearchParams(searchParams)
      novos.delete('projeto')
      setSearchParams(novos, { replace: true })
    }
  }, [projetos, searchParams, setSearchParams])

  const projetoAberto = projetos.find((p) => p.id === projetoAbertoId) || null

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-(--color-ink)">Projetos</h1>
        <p className="mt-0.5 text-sm text-(--color-ink-secondary)">Serviços contratados que serão executados pela Moraes.Dev.</p>
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
          <TabelaProjetos projetos={projetos} onAbrirProjeto={(p) => setProjetoAbertoId(p.id)} />
        </div>
      )}

      <DrawerProjeto
        projeto={projetoAberto}
        onFechar={() => setProjetoAbertoId(null)}
        onAbrirCliente={(clientId) => navigate(`/dashboard/clientes?cliente=${clientId}`)}
        onVerLead={(leadId) => navigate(`/dashboard/crm?lead=${leadId}`)}
      />
    </div>
  )
}
