// "Acessos rápidos" — atalhos configuráveis por pessoa (user_shortcuts,
// migration 0005_fase_2f). CRUD simples (adicionar/editar/remover) +
// reordenação por setas (não é drag-and-drop, pra não aumentar escopo).
//
// Segurança (item do planejamento): só aceita URL http/https (validado em
// DashboardService.validarUrlAtalho, chamado aqui E de novo no service —
// defesa em profundidade); nunca javascript:/data:; todo link abre com
// target="_blank" rel="noopener noreferrer".
import { useState, useEffect, useCallback } from 'react'
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Link2,
  Globe,
  FileText,
  Mail,
  LayoutDashboard,
  Code2,
} from 'lucide-react'
import {
  listarAtalhos,
  criarAtalho,
  atualizarAtalho,
  excluirAtalho,
  trocarOrdemAtalhos,
  validarUrlAtalho,
} from '../../lib/dashboard/DashboardService'
import SecaoCard from './SecaoCard'

const ICONES = {
  link: Link2,
  site: Globe,
  documento: FileText,
  email: Mail,
  painel: LayoutDashboard,
  codigo: Code2,
}

function IconeAtalho({ slug, ...props }) {
  const Icon = ICONES[slug] || Link2
  return <Icon {...props} />
}

function FormularioAtalho({ inicial, onSalvar, onCancelar }) {
  const [nome, setNome] = useState(inicial?.nome || '')
  const [url, setUrl] = useState(inicial?.url || '')
  const [icone, setIcone] = useState(inicial?.icone || 'link')
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  function submeter(e) {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('Dê um nome para o atalho.')
      return
    }
    if (!validarUrlAtalho(url)) {
      setErro('URL inválida — use um link completo começando com http:// ou https://.')
      return
    }
    setErro(null)
    setSalvando(true)
    onSalvar({ nome: nome.trim(), url: url.trim(), icone }).catch((e) => {
      setErro(e?.message || 'Não foi possível salvar o atalho.')
      setSalvando(false)
    })
  }

  return (
    <form onSubmit={submeter} className="space-y-2 rounded-xl border border-(--color-line) bg-(--color-canvas) p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome (ex.: Supabase)"
          className="rounded-lg border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-xs text-(--color-ink)"
        />
        <select
          value={icone}
          onChange={(e) => setIcone(e.target.value)}
          className="rounded-lg border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-xs text-(--color-ink)"
        >
          {Object.keys(ICONES).map((slug) => (
            <option key={slug} value={slug}>
              {slug}
            </option>
          ))}
        </select>
      </div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
        className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-xs text-(--color-ink)"
      />
      {erro ? <p className="text-[11px] text-(--color-danger)">{erro}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-(--color-ink-secondary)">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={salvando}
          className="rounded-lg bg-(--color-primary) px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
        >
          Salvar
        </button>
      </div>
    </form>
  )
}

// Hook local (não usa useSecaoDados direto porque precisa de `recarregar`
// manual além do refreshKey global — toda escrita no CRUD acima dispara uma
// recarga imediata, sem esperar o botão "Atualizar" do Dashboard).
function useAtalhos(refreshKey) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [geracao, setGeracao] = useState(0)

  const recarregar = useCallback(() => setGeracao((g) => g + 1), [])

  useEffect(() => {
    let vivo = true
    Promise.resolve()
      .then(() => {
        if (!vivo) return undefined
        setCarregando(true)
        setErro(null)
        return listarAtalhos()
      })
      .then((res) => {
        if (vivo && res !== undefined) setDados(res)
      })
      .catch((e) => {
        if (vivo) setErro(e?.message || 'Não foi possível carregar os atalhos.')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [refreshKey, geracao])

  return { dados, carregando, erro, recarregar }
}

export default function AcessosRapidos({ refreshKey }) {
  const { dados, carregando, erro, recarregar } = useAtalhos(refreshKey)
  const atalhos = dados || []
  const [modo, setModo] = useState(null) // null | 'novo' | { editando: atalho }

  async function salvarNovo(valores) {
    await criarAtalho(valores)
    setModo(null)
    recarregar()
  }

  async function salvarEdicao(atalho, valores) {
    await atualizarAtalho(atalho.id, valores)
    setModo(null)
    recarregar()
  }

  async function remover(atalho) {
    if (!window.confirm(`Remover o atalho "${atalho.nome}"?`)) return
    await excluirAtalho(atalho.id)
    recarregar()
  }

  async function mover(atalho, direcao) {
    const indice = atalhos.findIndex((a) => a.id === atalho.id)
    const vizinho = atalhos[indice + direcao]
    if (!vizinho) return
    await trocarOrdemAtalhos(atalho, vizinho)
    recarregar()
  }

  return (
    <SecaoCard
      titulo="Acessos rápidos"
      icon={Zap}
      carregando={carregando}
      erro={erro}
      vazio={!carregando && atalhos.length === 0 && modo !== 'novo'}
      mensagemVazia="Nenhum atalho configurado ainda — adicione os links que você mais usa."
    >
      <div className="space-y-1.5">
        {atalhos.map((atalho, i) =>
          modo?.editando?.id === atalho.id ? (
            <FormularioAtalho key={atalho.id} inicial={atalho} onSalvar={(v) => salvarEdicao(atalho, v)} onCancelar={() => setModo(null)} />
          ) : (
            <div key={atalho.id} className="flex items-center gap-2 rounded-xl border border-(--color-line) px-2.5 py-1.5 text-xs">
              <a
                href={atalho.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2 text-(--color-ink) hover:text-(--color-primary)"
              >
                <IconeAtalho slug={atalho.icone} size={14} className="shrink-0 text-(--color-ink-secondary)" />
                <span className="truncate font-medium">{atalho.nome}</span>
                <ExternalLink size={11} className="shrink-0 text-(--color-ink-secondary)" />
              </a>
              <div className="flex shrink-0 items-center gap-0.5">
                <button type="button" onClick={() => mover(atalho, -1)} disabled={i === 0} className="rounded p-1 text-(--color-ink-secondary) disabled:opacity-30">
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => mover(atalho, 1)}
                  disabled={i === atalhos.length - 1}
                  className="rounded p-1 text-(--color-ink-secondary) disabled:opacity-30"
                >
                  <ArrowDown size={12} />
                </button>
                <button type="button" onClick={() => setModo({ editando: atalho })} className="rounded p-1 text-(--color-ink-secondary) hover:text-(--color-primary)">
                  <Pencil size={12} />
                </button>
                <button type="button" onClick={() => remover(atalho)} className="rounded p-1 text-(--color-ink-secondary) hover:text-(--color-danger)">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )
        )}

        {modo === 'novo' ? (
          <FormularioAtalho onSalvar={salvarNovo} onCancelar={() => setModo(null)} />
        ) : (
          <button
            type="button"
            onClick={() => setModo('novo')}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-(--color-line) py-2 text-xs font-semibold text-(--color-ink-secondary) hover:border-(--color-primary) hover:text-(--color-primary)"
          >
            <Plus size={13} /> Adicionar atalho
          </button>
        )}
      </div>
    </SecaoCard>
  )
}
