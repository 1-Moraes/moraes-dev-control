// Subpainel secundário do projeto — reúne Briefing, Arquivos, Links,
// Infraestrutura, Alterações solicitadas e Deploys (itens 28-35 do
// planejamento da Fase 2E) em abas, para não transformar o painel
// panorâmico principal numa tela infinita (item 27). Abre por cima do
// painel, com a mesma linguagem visual (backdrop + card central).
import { useEffect, useState } from 'react'
import { X, Plus, Trash2, Loader2, ExternalLink } from 'lucide-react'
import {
  CAMPOS_BRIEFING,
  TIPOS_LINK,
  TIPOS_ARQUIVO,
  STATUS_ALTERACAO,
  AMBIENTES_DEPLOY,
  PRIORIDADES_PROJETO,
  atualizarBriefing,
  listarArquivosProjeto,
  adicionarArquivo,
  excluirArquivo,
  listarLinksProjeto,
  adicionarLink,
  excluirLink,
  atualizarInfraestrutura,
  listarAlteracoesProjeto,
  criarAlteracao,
  atualizarStatusAlteracao,
  listarDeploysProjeto,
  registrarDeploy,
} from '../../lib/projects/ProjectsService'

const ABAS = [
  { chave: 'briefing', label: 'Briefing' },
  { chave: 'arquivos', label: 'Arquivos' },
  { chave: 'links', label: 'Links' },
  { chave: 'infra', label: 'Infraestrutura' },
  { chave: 'alteracoes', label: 'Alterações' },
  { chave: 'deploys', label: 'Deploys' },
]

function AbaBriefing({ projeto, onAtualizado }) {
  const [valores, setValores] = useState(() => projeto.briefing || {})
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    try {
      const atualizado = await atualizarBriefing(projeto.id, valores)
      onAtualizado(atualizado)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-3">
      {CAMPOS_BRIEFING.map((campo) => (
        <div key={campo.chave}>
          <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">{campo.label}</label>
          <textarea
            value={valores[campo.chave] || ''}
            onChange={(e) => setValores((v) => ({ ...v, [campo.chave]: e.target.value }))}
            rows={2}
            placeholder="Somente preencher se existir informação correspondente. Não obrigatório."
            className="mt-1 w-full resize-none rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="flex items-center gap-1.5 rounded-xl bg-(--color-primary) px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        {salvando ? <Loader2 size={13} className="animate-spin" /> : null} Salvar briefing
      </button>
    </div>
  )
}

function AbaArquivos({ projeto }) {
  const [arquivos, setArquivos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [novo, setNovo] = useState({ nome_arquivo: '', url: '', tipo: 'outro' })
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    listarArquivosProjeto(projeto.id)
      .then(setArquivos)
      .finally(() => setCarregando(false))
  }, [projeto.id])

  async function adicionar() {
    if (!novo.url.trim() || enviando) return
    setEnviando(true)
    try {
      const criado = await adicionarArquivo(projeto.id, novo)
      setArquivos((a) => [criado, ...a])
      setNovo({ nome_arquivo: '', url: '', tipo: 'outro' })
    } finally {
      setEnviando(false)
    }
  }

  async function remover(arquivo) {
    await excluirArquivo(arquivo)
    setArquivos((a) => a.filter((x) => x.id !== arquivo.id))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-(--color-ink-secondary)">
        Nesta fase, arquivos são referenciados por link (upload binário direto fica para quando o Supabase Storage do projeto for avaliado).
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={novo.nome_arquivo}
          onChange={(e) => setNovo((n) => ({ ...n, nome_arquivo: e.target.value }))}
          placeholder="Nome do arquivo"
          className="min-w-[8rem] flex-1 rounded-lg border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-xs text-(--color-ink) outline-none"
        />
        <input
          value={novo.url}
          onChange={(e) => setNovo((n) => ({ ...n, url: e.target.value }))}
          placeholder="URL do arquivo"
          className="min-w-[10rem] flex-[2] rounded-lg border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-xs text-(--color-ink) outline-none"
        />
        <select
          value={novo.tipo}
          onChange={(e) => setNovo((n) => ({ ...n, tipo: e.target.value }))}
          className="rounded-lg border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-xs text-(--color-ink)"
        >
          {TIPOS_ARQUIVO.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={adicionar} disabled={enviando} className="rounded-lg bg-(--color-primary) p-1.5 text-white disabled:opacity-50">
          <Plus size={14} />
        </button>
      </div>
      {carregando ? (
        <Loader2 size={16} className="animate-spin text-(--color-ink-secondary)" />
      ) : arquivos.length === 0 ? (
        <p className="py-6 text-center text-xs text-(--color-ink-secondary)">Nenhum arquivo adicionado.</p>
      ) : (
        <div className="space-y-1.5">
          {arquivos.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-(--color-line) px-2.5 py-1.5 text-xs">
              <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-(--color-primary) hover:underline">
                <ExternalLink size={11} className="shrink-0" /> {a.nome_arquivo || a.url}
              </a>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-(--color-ink-secondary)">{TIPOS_ARQUIVO.find((t) => t.valor === a.tipo)?.label}</span>
                <button type="button" onClick={() => remover(a)} className="text-(--color-ink-secondary) hover:text-(--color-danger)">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AbaLinks({ projeto }) {
  const [links, setLinks] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [novo, setNovo] = useState({ nome: '', tipo: 'outro', url: '' })
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    listarLinksProjeto(projeto.id)
      .then(setLinks)
      .finally(() => setCarregando(false))
  }, [projeto.id])

  async function adicionar() {
    if (!novo.nome.trim() || !novo.url.trim() || enviando) return
    setEnviando(true)
    try {
      const criado = await adicionarLink(projeto.id, novo)
      setLinks((l) => [criado, ...l])
      setNovo({ nome: '', tipo: 'outro', url: '' })
    } finally {
      setEnviando(false)
    }
  }

  async function remover(link) {
    await excluirLink(link)
    setLinks((l) => l.filter((x) => x.id !== link.id))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={novo.nome}
          onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))}
          placeholder="Nome do link"
          className="min-w-[8rem] flex-1 rounded-lg border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-xs text-(--color-ink) outline-none"
        />
        <select
          value={novo.tipo}
          onChange={(e) => setNovo((n) => ({ ...n, tipo: e.target.value }))}
          className="rounded-lg border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-xs text-(--color-ink)"
        >
          {TIPOS_LINK.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          value={novo.url}
          onChange={(e) => setNovo((n) => ({ ...n, url: e.target.value }))}
          placeholder="URL"
          className="min-w-[10rem] flex-[2] rounded-lg border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-xs text-(--color-ink) outline-none"
        />
        <button type="button" onClick={adicionar} disabled={enviando} className="rounded-lg bg-(--color-primary) p-1.5 text-white disabled:opacity-50">
          <Plus size={14} />
        </button>
      </div>
      {carregando ? (
        <Loader2 size={16} className="animate-spin text-(--color-ink-secondary)" />
      ) : links.length === 0 ? (
        <p className="py-6 text-center text-xs text-(--color-ink-secondary)">Nenhum link cadastrado.</p>
      ) : (
        <div className="space-y-1.5">
          {links.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg border border-(--color-line) px-2.5 py-1.5 text-xs">
              <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-(--color-primary) hover:underline">
                <ExternalLink size={11} className="shrink-0" /> {l.nome}
              </a>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-(--color-ink-secondary)">{TIPOS_LINK.find((t) => t.valor === l.tipo)?.label}</span>
                <button type="button" onClick={() => remover(l)} className="text-(--color-ink-secondary) hover:text-(--color-danger)">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AbaInfra({ projeto, onAtualizado }) {
  const [valores, setValores] = useState(() => ({
    infra_dominio: projeto.infra_dominio || '',
    infra_hospedagem: projeto.infra_hospedagem || '',
    infra_repositorio: projeto.infra_repositorio || '',
    infra_homologacao_url: projeto.infra_homologacao_url || '',
    infra_banco: projeto.infra_banco || '',
    infra_observacoes: projeto.infra_observacoes || '',
  }))
  const [salvando, setSalvando] = useState(false)

  const campos = [
    { chave: 'infra_dominio', label: 'Domínio' },
    { chave: 'infra_hospedagem', label: 'Hospedagem' },
    { chave: 'infra_repositorio', label: 'Repositório' },
    { chave: 'infra_homologacao_url', label: 'Ambiente de homologação (URL)' },
    { chave: 'infra_banco', label: 'Banco de dados' },
  ]

  async function salvar() {
    setSalvando(true)
    try {
      const atualizado = await atualizarInfraestrutura(projeto.id, valores)
      onAtualizado(atualizado)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-(--color-ink-secondary)">Apenas metadados não sensíveis — nunca senhas, tokens, API keys ou credenciais.</p>
      {campos.map((c) => (
        <div key={c.chave}>
          <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">{c.label}</label>
          <input
            value={valores[c.chave]}
            onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
          />
        </div>
      ))}
      <div>
        <label className="text-[11px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">Observações</label>
        <textarea
          value={valores.infra_observacoes}
          onChange={(e) => setValores((v) => ({ ...v, infra_observacoes: e.target.value }))}
          rows={2}
          className="mt-1 w-full resize-none rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
        />
      </div>
      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="flex items-center gap-1.5 rounded-xl bg-(--color-primary) px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        {salvando ? <Loader2 size={13} className="animate-spin" /> : null} Salvar infraestrutura
      </button>
    </div>
  )
}

function AbaAlteracoes({ projeto }) {
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [descricao, setDescricao] = useState('')
  const [prioridade, setPrioridade] = useState('media')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    listarAlteracoesProjeto(projeto.id)
      .then(setItens)
      .finally(() => setCarregando(false))
  }, [projeto.id])

  async function criar() {
    if (!descricao.trim() || enviando) return
    setEnviando(true)
    try {
      const criado = await criarAlteracao(projeto.id, { descricao: descricao.trim(), prioridade })
      setItens((i) => [criado, ...i])
      setDescricao('')
    } finally {
      setEnviando(false)
    }
  }

  async function mudarStatus(item, status) {
    const atualizado = await atualizarStatusAlteracao(item, status)
    setItens((i) => i.map((x) => (x.id === item.id ? atualizado : x)))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descrever a alteração solicitada..."
          className="min-w-[10rem] flex-1 rounded-lg border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-xs text-(--color-ink) outline-none"
        />
        <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className="rounded-lg border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-xs text-(--color-ink)">
          {PRIORIDADES_PROJETO.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={criar} disabled={enviando} className="rounded-lg bg-(--color-primary) p-1.5 text-white disabled:opacity-50">
          <Plus size={14} />
        </button>
      </div>
      {carregando ? (
        <Loader2 size={16} className="animate-spin text-(--color-ink-secondary)" />
      ) : itens.length === 0 ? (
        <p className="py-6 text-center text-xs text-(--color-ink-secondary)">Nenhuma alteração solicitada.</p>
      ) : (
        <div className="space-y-1.5">
          {itens.map((item) => (
            <div key={item.id} className="rounded-lg border border-(--color-line) px-2.5 py-1.5 text-xs">
              <p className="text-(--color-ink)">{item.descricao}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-(--color-ink-secondary)">{new Date(item.solicitada_em).toLocaleDateString('pt-BR')}</span>
                <select
                  value={item.status}
                  onChange={(e) => mudarStatus(item, e.target.value)}
                  className="rounded-md border border-(--color-line) bg-(--color-canvas) px-1.5 py-0.5 text-[10px] text-(--color-ink)"
                >
                  {STATUS_ALTERACAO.map((s) => (
                    <option key={s.valor} value={s.valor}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AbaDeploys({ projeto }) {
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [novo, setNovo] = useState({ ambiente: 'homologacao', versao_descricao: '', url: '' })
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    listarDeploysProjeto(projeto.id)
      .then(setItens)
      .finally(() => setCarregando(false))
  }, [projeto.id])

  async function registrar() {
    if (enviando) return
    setEnviando(true)
    try {
      const criado = await registrarDeploy(projeto.id, novo)
      setItens((i) => [criado, ...i])
      setNovo({ ambiente: 'homologacao', versao_descricao: '', url: '' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={novo.ambiente}
          onChange={(e) => setNovo((n) => ({ ...n, ambiente: e.target.value }))}
          className="rounded-lg border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-xs text-(--color-ink)"
        >
          {AMBIENTES_DEPLOY.map((a) => (
            <option key={a.valor} value={a.valor}>
              {a.label}
            </option>
          ))}
        </select>
        <input
          value={novo.versao_descricao}
          onChange={(e) => setNovo((n) => ({ ...n, versao_descricao: e.target.value }))}
          placeholder="Versão/descrição"
          className="min-w-[8rem] flex-1 rounded-lg border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-xs text-(--color-ink) outline-none"
        />
        <input
          value={novo.url}
          onChange={(e) => setNovo((n) => ({ ...n, url: e.target.value }))}
          placeholder="URL"
          className="min-w-[8rem] flex-1 rounded-lg border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-xs text-(--color-ink) outline-none"
        />
        <button type="button" onClick={registrar} disabled={enviando} className="rounded-lg bg-(--color-primary) p-1.5 text-white disabled:opacity-50">
          <Plus size={14} />
        </button>
      </div>
      {carregando ? (
        <Loader2 size={16} className="animate-spin text-(--color-ink-secondary)" />
      ) : itens.length === 0 ? (
        <p className="py-6 text-center text-xs text-(--color-ink-secondary)">Nenhum deploy registrado.</p>
      ) : (
        <div className="space-y-1.5">
          {itens.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-(--color-line) px-2.5 py-1.5 text-xs">
              <div>
                <p className="text-(--color-ink)">
                  {AMBIENTES_DEPLOY.find((a) => a.valor === d.ambiente)?.label} — {d.versao_descricao || 'sem descrição'}
                </p>
                <p className="text-[10px] text-(--color-ink-secondary)">
                  {new Date(d.data_deploy).toLocaleDateString('pt-BR')} · {d.responsavel?.nome || 'Equipe'}
                </p>
              </div>
              <span className="text-[10px] font-semibold text-(--color-ink-secondary)">{d.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SubpainelProjetoConteudo({ projeto, abaInicial, onFechar, onProjetoAtualizado }) {
  const [aba, setAba] = useState(abaInicial)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onFechar} />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-(--color-surface) shadow-xl">
        <div className="flex items-center justify-between border-b border-(--color-line) px-4 py-3">
          <h2 className="font-display text-sm font-semibold text-(--color-ink)">Detalhes de {projeto.nome}</h2>
          <button type="button" onClick={onFechar} className="rounded-lg p-1 text-(--color-ink-secondary) hover:bg-(--color-canvas)">
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-(--color-line) px-3 pt-2">
          {ABAS.map((a) => (
            <button
              key={a.chave}
              type="button"
              onClick={() => setAba(a.chave)}
              className={`whitespace-nowrap rounded-t-lg px-3 py-1.5 text-xs font-semibold ${
                aba === a.chave ? 'border-b-2 border-(--color-primary) text-(--color-primary)' : 'text-(--color-ink-secondary) hover:text-(--color-ink)'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {aba === 'briefing' ? <AbaBriefing projeto={projeto} onAtualizado={onProjetoAtualizado} /> : null}
          {aba === 'arquivos' ? <AbaArquivos projeto={projeto} /> : null}
          {aba === 'links' ? <AbaLinks projeto={projeto} /> : null}
          {aba === 'infra' ? <AbaInfra projeto={projeto} onAtualizado={onProjetoAtualizado} /> : null}
          {aba === 'alteracoes' ? <AbaAlteracoes projeto={projeto} /> : null}
          {aba === 'deploys' ? <AbaDeploys projeto={projeto} /> : null}
        </div>
      </div>
    </div>
  )
}

// Wrapper fino + remount por key (mesmo padrão de DrawerCliente/DrawerProjeto):
// garante que a aba inicial sempre reflita `abaInicial` quando o painel é
// reaberto, sem precisar sincronizar estado num efeito.
export default function SubpainelProjeto({ projeto, abaInicial = 'briefing', onFechar, onProjetoAtualizado }) {
  if (!projeto) return null
  return (
    <SubpainelProjetoConteudo
      key={`${projeto.id}:${abaInicial}`}
      projeto={projeto}
      abaInicial={abaInicial}
      onFechar={onFechar}
      onProjetoAtualizado={onProjetoAtualizado}
    />
  )
}
