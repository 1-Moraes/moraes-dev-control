// Drawer lateral de detalhes do lead — itens 11, 12 e 13 do planejamento
// da Fase 2C (seções Empresa/Comercial/Notas/Atividades + ações rápidas +
// CNPJ.ws).
import { useEffect, useState } from 'react'
import {
  X,
  Star,
  Phone,
  MessageCircle,
  Globe,
  Search as SearchIcon,
  FileSearch,
  Loader2,
  Send,
} from 'lucide-react'
import {
  STATUS_PIPELINE,
  STATUS_LABEL,
  PRIORIDADES,
  PROXIMA_ACAO_TIPOS,
  listarNotas,
  listarAtividades,
  adicionarNota,
  atualizarCampos,
  listarMembrosEquipe,
} from '../../lib/crm/LeadsService'

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

// Wrapper fino: só decide SE o drawer existe. A `key={lead.id}` no
// conteúdo abaixo é o que permite ao estado local do formulário
// comercial nascer já preenchido via useState(() => ...) a partir de
// `lead` — ao trocar de lead, o React desmonta e remonta o conteúdo do
// zero, então não precisamos de um useEffect "sincronizando" esse estado
// a partir da prop (o padrão que a regra react-hooks/set-state-in-effect
// pede para evitar — ver https://react.dev/learn/you-might-not-need-an-effect,
// seção "Adjusting state when a prop changes").
export default function DrawerLead({ lead, onFechar, onMoverStatus, onLeadAtualizado }) {
  if (!lead) return null
  return <DrawerLeadConteudo key={lead.id} lead={lead} onFechar={onFechar} onMoverStatus={onMoverStatus} onLeadAtualizado={onLeadAtualizado} />
}

function DrawerLeadConteudo({ lead, onFechar, onMoverStatus, onLeadAtualizado }) {
  const [notas, setNotas] = useState([])
  const [atividades, setAtividades] = useState([])
  const [equipe, setEquipe] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [novaNota, setNovaNota] = useState('')
  const [enviandoNota, setEnviandoNota] = useState(false)
  const [salvandoComercial, setSalvandoComercial] = useState(false)
  const [comercial, setComercial] = useState(() => ({
    prioridade: lead.prioridade || 'media',
    responsavel_id: lead.responsavel_id || '',
    servico_interesse: lead.servico_interesse || '',
    observacoes: lead.observacoes || '',
    proxima_acao_tipo: lead.proxima_acao_tipo || '',
    proxima_acao_data: lead.proxima_acao_data ? lead.proxima_acao_data.slice(0, 16) : '',
    proxima_acao_descricao: lead.proxima_acao_descricao || '',
  }))

  // Busca de notas/atividades/equipe — único setState direto no corpo do
  // effect é a limpeza do cleanup (`cancelado = true`, uma variável local,
  // não estado de React); os setNotas/setAtividades/setEquipe/setCarregando
  // de verdade só rodam dentro de .then()/.catch()/.finally(), mesmo
  // padrão usado em AuthContext.jsx (getSession().then(...)).
  useEffect(() => {
    let cancelado = false
    Promise.all([listarNotas(lead.id), listarAtividades(lead.id), listarMembrosEquipe()])
      .then(([n, a, m]) => {
        if (cancelado) return
        setNotas(n)
        setAtividades(a)
        setEquipe(m)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [lead.id])

  async function salvarComercial() {
    setSalvandoComercial(true)
    try {
      const patch = {
        prioridade: comercial.prioridade,
        responsavel_id: comercial.responsavel_id || null,
        servico_interesse: comercial.servico_interesse || null,
        observacoes: comercial.observacoes || null,
        proxima_acao_tipo: comercial.proxima_acao_tipo || null,
        proxima_acao_data: comercial.proxima_acao_data ? new Date(comercial.proxima_acao_data).toISOString() : null,
        proxima_acao_descricao: comercial.proxima_acao_descricao || null,
      }
      const atualizado = await atualizarCampos(lead.id, patch, 'Dados comerciais atualizados.')
      onLeadAtualizado?.(atualizado)
      const a = await listarAtividades(lead.id)
      setAtividades(a)
    } finally {
      setSalvandoComercial(false)
    }
  }

  async function enviarNota() {
    const texto = novaNota.trim()
    if (!texto) return
    setEnviandoNota(true)
    try {
      await adicionarNota(lead.id, texto)
      setNovaNota('')
      const [n, a] = await Promise.all([listarNotas(lead.id), listarAtividades(lead.id)])
      setNotas(n)
      setAtividades(a)
    } finally {
      setEnviandoNota(false)
    }
  }

  const linkWhatsapp = telefoneParaWhatsapp(lead.telefone)
  const linkGoogle = `https://www.google.com/search?q=${encodeURIComponent([lead.nome_empresa, lead.cidade].filter(Boolean).join(' '))}`
  const linkCnpjWs = `https://cnpj.ws/busca?q=${encodeURIComponent(lead.nome_empresa || '')}`

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onFechar} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-(--color-surface) p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-(--color-ink)">{lead.nome_empresa}</h2>
            <p className="text-xs text-(--color-ink-secondary)">{lead.categoria || 'Sem segmento'}</p>
          </div>
          <button type="button" onClick={onFechar} className="shrink-0 rounded-lg p-1.5 text-(--color-ink-secondary) hover:bg-(--color-canvas)">
            <X size={18} />
          </button>
        </div>

        {/* Status do pipeline */}
        <div className="mt-4">
          <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Status</label>
          <select
            value={lead.status}
            onChange={(e) => onMoverStatus(lead, e.target.value)}
            className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
          >
            {STATUS_PIPELINE.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.label}
              </option>
            ))}
          </select>
          {lead.status === 'ganho' ? (
            <div className="mt-2 rounded-lg border border-(--color-green-light) bg-(--color-green-light)/15 px-3 py-2 text-xs text-(--color-ink)">
              Lead marcado como ganho.
              <button type="button" disabled className="ml-2 cursor-not-allowed font-semibold text-(--color-primary) opacity-60" title="Entra em uma fase futura">
                Converter em cliente
              </button>
            </div>
          ) : null}
          {lead.status === 'perdido' && lead.motivo_perda ? (
            <p className="mt-1.5 text-[11px] text-(--color-ink-secondary)">Motivo: {STATUS_LABEL[lead.motivo_perda] || lead.motivo_perda}</p>
          ) : null}
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
          {lead.telefone ? (
            <a href={`tel:${lead.telefone.replace(/\D/g, '')}`} className="flex items-center justify-center gap-1.5 rounded-xl border border-(--color-line) px-3 py-2 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)">
              <Phone size={14} /> Ligar
            </a>
          ) : (
            <span className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-(--color-line) px-3 py-2 text-xs text-(--color-ink-secondary)">
              <Phone size={14} /> Sem telefone
            </span>
          )}
          {lead.website ? (
            <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl border border-(--color-line) px-3 py-2 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)">
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
          <a href={linkCnpjWs} target="_blank" rel="noreferrer" className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-(--color-line) px-3 py-2 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)">
            <FileSearch size={14} /> Consultar CNPJ (CNPJ.ws — manual)
          </a>
        </div>

        {/* Seção Empresa */}
        <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-(--color-ink-secondary)">Empresa</h3>
        <dl className="mt-3 space-y-3">
          <Campo label="Nome fantasia" valor={lead.nome_fantasia} />
          <Campo label="Endereço" valor={[lead.endereco, lead.bairro].filter(Boolean).join(' · ')} />
          <Campo label="Cidade/Estado" valor={[lead.cidade, lead.estado].filter(Boolean).join(', ')} />
          <Campo label="Telefone" valor={lead.telefone} />
          <Campo label="Website" valor={lead.website} />
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Avaliação</dt>
            <dd className="mt-0.5 flex items-center gap-1 text-sm text-(--color-ink)">
              {lead.rating ? (
                <>
                  <Star size={13} fill="#f0a63d" className="text-(--color-amber)" />
                  {lead.rating} ({lead.quantidade_avaliacoes || 0})
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <Campo label="Origem" valor={lead.origem?.nome} />
        </dl>

        {/* Seção Comercial */}
        <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-(--color-ink-secondary)">Comercial</h3>
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Prioridade</label>
            <select
              value={comercial.prioridade}
              onChange={(e) => setComercial((c) => ({ ...c, prioridade: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none"
            >
              {PRIORIDADES.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Responsável</label>
            <select
              value={comercial.responsavel_id}
              onChange={(e) => setComercial((c) => ({ ...c, responsavel_id: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none"
            >
              <option value="">Sem responsável</option>
              {equipe.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Serviço de interesse</label>
            <input
              value={comercial.servico_interesse}
              onChange={(e) => setComercial((c) => ({ ...c, servico_interesse: e.target.value }))}
              placeholder="Ex.: Site institucional"
              className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Próxima ação</label>
              <select
                value={comercial.proxima_acao_tipo}
                onChange={(e) => setComercial((c) => ({ ...c, proxima_acao_tipo: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none"
              >
                <option value="">—</option>
                {PROXIMA_ACAO_TIPOS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Quando</label>
              <input
                type="datetime-local"
                value={comercial.proxima_acao_data}
                onChange={(e) => setComercial((c) => ({ ...c, proxima_acao_data: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-2 py-2 text-xs text-(--color-ink) outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Descrição da próxima ação</label>
            <input
              value={comercial.proxima_acao_descricao}
              onChange={(e) => setComercial((c) => ({ ...c, proxima_acao_descricao: e.target.value }))}
              placeholder="Breve descrição"
              className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Observações</label>
            <textarea
              value={comercial.observacoes}
              onChange={(e) => setComercial((c) => ({ ...c, observacoes: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none"
            />
          </div>
          <button
            type="button"
            onClick={salvarComercial}
            disabled={salvandoComercial}
            className="w-full rounded-xl bg-(--color-primary) px-4 py-2 text-xs font-semibold text-white hover:bg-(--color-primary-hover) disabled:opacity-60"
          >
            {salvandoComercial ? 'Salvando...' : 'Salvar dados comerciais'}
          </button>
        </div>

        {/* Seção Notas */}
        <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-(--color-ink-secondary)">Notas</h3>
        <div className="mt-3 flex gap-2">
          <input
            value={novaNota}
            onChange={(e) => setNovaNota(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enviarNota()}
            placeholder="Adicionar nota..."
            className="flex-1 rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
          />
          <button
            type="button"
            onClick={enviarNota}
            disabled={enviandoNota || !novaNota.trim()}
            className="flex items-center justify-center rounded-lg bg-(--color-primary) px-3 text-white disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {notas.map((n) => (
            <div key={n.id} className="rounded-lg bg-(--color-canvas) p-2.5 text-xs text-(--color-ink)">
              <p>{n.texto}</p>
              <p className="mt-1 text-[10px] text-(--color-ink-secondary)">
                {n.autor?.nome || 'Equipe'} · {new Date(n.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
          {!carregando && notas.length === 0 ? <p className="text-xs text-(--color-ink-secondary)">Nenhuma nota ainda.</p> : null}
        </div>

        {/* Seção Atividades */}
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
                <p className="text-(--color-ink)">{a.detalhe}</p>
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
