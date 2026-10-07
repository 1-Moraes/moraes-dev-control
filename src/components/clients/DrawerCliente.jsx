// Drawer de detalhe do cliente — item 14 do planejamento da Fase 2D:
// resumo, ações rápidas, projetos do cliente, histórico, origem (lead).
import { useEffect, useState } from 'react'
import { X, Phone, MessageCircle, Globe, Search as SearchIcon, Loader2, FolderPlus, ExternalLink } from 'lucide-react'
import { STATUS_CLIENTE, listarHistoricoCliente, atualizarCliente } from '../../lib/clients/ClientsService'
import { listarProjetosDoCliente, STATUS_PROJETO_LABEL } from '../../lib/projects/ProjectsService'

function Campo({ label, valor }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">{label}</dt>
      <dd className="mt-0.5 text-sm text-(--color-ink)">{valor || '—'}</dd>
    </div>
  )
}

function telefoneParaWhatsapp(tel) {
  if (!tel) return null
  const digitos = tel.replace(/\D/g, '')
  if (!digitos) return null
  const comPais = digitos.startsWith('55') ? digitos : `55${digitos}`
  return `https://wa.me/${comPais}`
}

export default function DrawerCliente({ cliente, onFechar, onVerLead, onAbrirProjeto, onCriarProjeto, onClienteAtualizado }) {
  if (!cliente) return null
  return (
    <DrawerClienteConteudo
      key={cliente.id}
      cliente={cliente}
      onFechar={onFechar}
      onVerLead={onVerLead}
      onAbrirProjeto={onAbrirProjeto}
      onCriarProjeto={onCriarProjeto}
      onClienteAtualizado={onClienteAtualizado}
    />
  )
}

function DrawerClienteConteudo({ cliente, onFechar, onVerLead, onAbrirProjeto, onCriarProjeto, onClienteAtualizado }) {
  const [historico, setHistorico] = useState([])
  const [projetos, setProjetos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [salvandoStatus, setSalvandoStatus] = useState(false)

  useEffect(() => {
    let cancelado = false
    Promise.all([listarHistoricoCliente(cliente.id), listarProjetosDoCliente(cliente.id)])
      .then(([h, p]) => {
        if (cancelado) return
        setHistorico(h)
        setProjetos(p)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [cliente.id])

  async function mudarStatus(novoStatus) {
    setSalvandoStatus(true)
    try {
      const anterior = STATUS_CLIENTE.find((s) => s.valor === cliente.status)?.label || cliente.status
      const novo = STATUS_CLIENTE.find((s) => s.valor === novoStatus)?.label || novoStatus
      const atualizado = await atualizarCliente(cliente.id, { status: novoStatus }, `Status alterado: ${anterior} → ${novo}.`)
      onClienteAtualizado?.(atualizado)
      const h = await listarHistoricoCliente(cliente.id)
      setHistorico(h)
    } finally {
      setSalvandoStatus(false)
    }
  }

  const linkWhatsapp = telefoneParaWhatsapp(cliente.telefone)
  const linkGoogle = `https://www.google.com/search?q=${encodeURIComponent([cliente.nome_empresa, cliente.cidade].filter(Boolean).join(' '))}`

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onFechar} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-(--color-surface) p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-(--color-ink)">{cliente.nome_empresa}</h2>
            <p className="text-xs text-(--color-ink-secondary)">{cliente.segmento || 'Sem segmento'}</p>
          </div>
          <button type="button" onClick={onFechar} className="shrink-0 rounded-lg p-1.5 text-(--color-ink-secondary) hover:bg-(--color-canvas)">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4">
          <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Status</label>
          <select
            value={cliente.status}
            onChange={(e) => mudarStatus(e.target.value)}
            disabled={salvandoStatus}
            className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary) disabled:opacity-60"
          >
            {STATUS_CLIENTE.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Ações rápidas */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {linkWhatsapp ? (
            <a href={linkWhatsapp} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl border border-(--color-line) px-3 py-2 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)">
              <MessageCircle size={14} /> WhatsApp
            </a>
          ) : (
            <span className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-(--color-line) px-3 py-2 text-xs text-(--color-ink-secondary)">
              <MessageCircle size={14} /> Sem telefone
            </span>
          )}
          {cliente.telefone ? (
            <a href={`tel:${cliente.telefone.replace(/\D/g, '')}`} className="flex items-center justify-center gap-1.5 rounded-xl border border-(--color-line) px-3 py-2 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)">
              <Phone size={14} /> Ligar
            </a>
          ) : (
            <span className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-(--color-line) px-3 py-2 text-xs text-(--color-ink-secondary)">
              <Phone size={14} /> Sem telefone
            </span>
          )}
          {cliente.website ? (
            <a href={cliente.website} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl border border-(--color-line) px-3 py-2 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)">
              <Globe size={14} /> Website
            </a>
          ) : (
            <span className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-(--color-line) px-3 py-2 text-xs text-(--color-ink-secondary)">
              <Globe size={14} /> Sem website
            </span>
          )}
          <a href={linkGoogle} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl border border-(--color-line) px-3 py-2 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)">
            <SearchIcon size={14} /> Google
          </a>
        </div>

        {cliente.lead_id ? (
          <button
            type="button"
            onClick={() => onVerLead?.(cliente.lead_id)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-(--color-line) px-3 py-2 text-xs font-semibold text-(--color-primary) hover:bg-(--color-canvas)"
          >
            <ExternalLink size={13} /> Ver lead de origem
          </button>
        ) : null}

        {/* Resumo */}
        <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-(--color-ink-secondary)">Resumo</h3>
        <dl className="mt-3 space-y-3">
          <Campo label="Endereço" valor={[cliente.endereco, cliente.bairro].filter(Boolean).join(' · ')} />
          <Campo label="Cidade/Estado" valor={[cliente.cidade, cliente.estado].filter(Boolean).join(', ')} />
          <Campo label="E-mail" valor={cliente.email} />
          <Campo label="Responsável" valor={cliente.responsavel?.nome} />
          <Campo label="Cliente desde" valor={cliente.data_inicio_relacionamento ? new Date(cliente.data_inicio_relacionamento).toLocaleDateString('pt-BR') : null} />
          <Campo label="Observações" valor={cliente.observacoes} />
        </dl>

        {/* Projetos */}
        <div className="mt-6 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wide text-(--color-ink-secondary)">Projetos</h3>
          <button
            type="button"
            onClick={() => onCriarProjeto?.(cliente)}
            className="flex items-center gap-1 text-xs font-semibold text-(--color-primary) hover:underline"
          >
            <FolderPlus size={13} /> Criar projeto
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {projetos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onAbrirProjeto?.(p)}
              className="flex w-full items-center justify-between rounded-lg border border-(--color-line) bg-(--color-canvas) px-3 py-2 text-left text-xs hover:border-(--color-primary-soft)"
            >
              <span className="font-medium text-(--color-ink)">{p.nome}</span>
              <span className="text-(--color-ink-secondary)">{STATUS_PROJETO_LABEL[p.status] || p.status}</span>
            </button>
          ))}
          {!carregando && projetos.length === 0 ? <p className="text-xs text-(--color-ink-secondary)">Nenhum projeto criado para este cliente.</p> : null}
        </div>

        {/* Histórico */}
        <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-(--color-ink-secondary)">Histórico</h3>
        <div className="mt-3 space-y-2 border-l border-(--color-line) pl-3">
          {carregando ? (
            <div className="flex items-center gap-2 text-xs text-(--color-ink-secondary)">
              <Loader2 size={13} className="animate-spin" /> Carregando...
            </div>
          ) : (
            historico.map((h) => (
              <div key={h.id} className="relative text-xs">
                <span className="absolute -left-[15px] top-1 h-2 w-2 rounded-full bg-(--color-primary)" />
                <p className="text-(--color-ink)">{h.metadata?.descricao || h.acao}</p>
                <p className="text-[10px] text-(--color-ink-secondary)">
                  {h.autor?.nome || 'Equipe'} · {new Date(h.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ))
          )}
          {!carregando && historico.length === 0 ? <p className="text-xs text-(--color-ink-secondary)">Nenhum evento registrado.</p> : null}
        </div>
      </div>
    </div>
  )
}
