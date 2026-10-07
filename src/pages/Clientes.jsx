// Clientes — Fase 2D do planejamento. Transforma a página (antes um
// placeholder) em uma tela operacional: listagem/tabela com busca e
// filtros, cadastro manual, drawer de detalhe (resumo, ações rápidas,
// projetos, histórico) e deep-link (?cliente=<id>).
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, AlertTriangle, Users, Plus } from 'lucide-react'
import { listarClientes, criarClienteManual, listarMembrosEquipe } from '../lib/clients/ClientsService'
import { listarProjetos, criarProjeto } from '../lib/projects/ProjectsService'
import TabelaClientes from '../components/clients/TabelaClientes'
import DrawerCliente from '../components/clients/DrawerCliente'
import ModalNovoCliente from '../components/clients/ModalNovoCliente'
import ModalCriarProjeto from '../components/projects/ModalCriarProjeto'

export default function Clientes() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [clientes, setClientes] = useState([])
  const [projetos, setProjetos] = useState([])
  const [equipe, setEquipe] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [clienteAbertoId, setClienteAbertoId] = useState(null)
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [clienteParaProjeto, setClienteParaProjeto] = useState(null)
  const [mensagemSucesso, setMensagemSucesso] = useState(null)

  const carregar = useCallback(() => {
    return Promise.all([listarClientes(), listarProjetos(), listarMembrosEquipe()])
      .then(([c, p, e]) => {
        setClientes(c)
        setProjetos(p)
        setEquipe(e)
      })
      .catch((e) => setErro(e?.message || 'Não foi possível carregar os clientes.'))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Deep-link vindo de Projetos ou do CRM (?cliente=<id>) — mesmo padrão
  // de Crm.jsx (?lead=<id>): sincroniza estado local a partir da URL.
  useEffect(() => {
    const idParaAbrir = searchParams.get('cliente')
    const cliente = clientes.find((c) => c.id === idParaAbrir)
    if (idParaAbrir && cliente) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o drawer aberto a partir da URL (?cliente=)
      setClienteAbertoId(idParaAbrir)
      // "Criar projeto" no banner de conversão (DrawerLead) já chega aqui
      // com ?criarProjeto=1 — abre o modal direto, sem precisar de um
      // segundo clique dentro do drawer do cliente.
      if (searchParams.get('criarProjeto') === '1') {
        setClienteParaProjeto(cliente)
      }
      const novos = new URLSearchParams(searchParams)
      novos.delete('cliente')
      novos.delete('criarProjeto')
      setSearchParams(novos, { replace: true })
    }
  }, [clientes, searchParams, setSearchParams])

  const clientesComContagem = clientes.map((c) => ({
    ...c,
    projetos_count: projetos.filter((p) => p.client_id === c.id).length,
  }))

  const clienteAberto = clientesComContagem.find((c) => c.id === clienteAbertoId) || null

  async function novoClienteManual(dados) {
    const criado = await criarClienteManual(dados)
    setClientes((cs) => [criado, ...cs])
    setModalNovoAberto(false)
    setMensagemSucesso('Cliente criado.')
    setClienteAbertoId(criado.id)
  }

  async function confirmarCriarProjeto(dados) {
    const criado = await criarProjeto({ ...dados, client_id: clienteParaProjeto.id })
    setProjetos((ps) => [criado, ...ps])
    setClienteParaProjeto(null)
    setMensagemSucesso('Projeto criado.')
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-(--color-ink)">Clientes</h1>
          <p className="mt-0.5 text-sm text-(--color-ink-secondary)">
            Empresas que contrataram ou mantêm relacionamento com a Moraes.Dev — convertidas do CRM ou cadastradas diretamente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalNovoAberto(true)}
          className="flex items-center gap-1.5 rounded-xl bg-(--color-primary) px-4 py-2 text-xs font-semibold text-white hover:bg-(--color-primary-hover)"
        >
          <Plus size={14} /> Novo cliente
        </button>
      </div>

      {mensagemSucesso ? (
        <div className="rounded-xl border border-(--color-green-light)/40 bg-(--color-green-light)/15 px-3 py-2 text-xs text-(--color-ink)">{mensagemSucesso}</div>
      ) : null}

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
      ) : clientes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-(--color-line) bg-(--color-surface) p-10 text-center">
          <Users size={28} className="text-(--color-ink-secondary)" />
          <div>
            <p className="font-display text-sm font-semibold text-(--color-ink)">Nenhum cliente cadastrado ainda.</p>
            <p className="mt-1 max-w-sm text-xs text-(--color-ink-secondary)">Converta um lead ganho ou cadastre um cliente manualmente.</p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/dashboard/crm"
              className="rounded-xl border border-(--color-line) px-4 py-2 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)"
            >
              Ir para CRM
            </Link>
            <button
              type="button"
              onClick={() => setModalNovoAberto(true)}
              className="rounded-xl bg-(--color-primary) px-4 py-2 text-xs font-semibold text-white hover:bg-(--color-primary-hover)"
            >
              + Novo cliente
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <TabelaClientes clientes={clientesComContagem} onAbrirCliente={(c) => setClienteAbertoId(c.id)} />
        </div>
      )}

      <DrawerCliente
        cliente={clienteAberto}
        onFechar={() => setClienteAbertoId(null)}
        onVerLead={(leadId) => navigate(`/dashboard/crm?lead=${leadId}`)}
        onAbrirProjeto={(p) => navigate(`/dashboard/projetos?projeto=${p.id}`)}
        onCriarProjeto={(cliente) => setClienteParaProjeto(cliente)}
        onClienteAtualizado={(atualizado) => setClientes((cs) => cs.map((c) => (c.id === atualizado.id ? atualizado : c)))}
      />

      <ModalNovoCliente aberto={modalNovoAberto} onCancelar={() => setModalNovoAberto(false)} onConfirmar={novoClienteManual} />

      <ModalCriarProjeto
        aberto={Boolean(clienteParaProjeto)}
        cliente={clienteParaProjeto}
        equipe={equipe}
        onCancelar={() => setClienteParaProjeto(null)}
        onConfirmar={confirmarCriarProjeto}
      />
    </div>
  )
}
