import { useRef, useState } from 'react'
import { Pencil, Check, X as XIcon, Plus, Trash2, Loader2 } from 'lucide-react'

// Tabela de um artigo da Base de Conhecimento — em modo leitura, renderiza
// como uma tabela normal (igual ao resto do Markdown do artigo). Ao clicar
// em "Editar tabela", vira um grid editável: cada célula é um campo de
// texto, navegável com as setas do teclado, com botões pra adicionar ou
// remover linha/coluna. "Salvar" manda o resultado pro componente-pai, que
// grava no Supabase e regenera o Markdown do artigo (fica sempre em
// sincronia com o que a busca da Base de Conhecimento enxerga).
export default function TabelaEditavel({ tabela, podeEditar, onSalvar }) {
  const [editando, setEditando] = useState(false)
  const [linhas, setLinhas] = useState(tabela.linhas)
  const [salvando, setSalvando] = useState(false)
  const refsCelulas = useRef([])

  function iniciarEdicao() {
    setLinhas(tabela.linhas.map((linha) => [...linha]))
    refsCelulas.current = []
    setEditando(true)
  }

  function cancelar() {
    setEditando(false)
  }

  function mudarCelula(r, c, valor) {
    setLinhas((prev) => {
      const novo = prev.map((linha) => [...linha])
      novo[r][c] = valor
      return novo
    })
  }

  function adicionarLinha() {
    const numColunas = linhas[0]?.length || 1
    setLinhas((prev) => [...prev, Array(numColunas).fill('')])
  }

  function removerLinha(r) {
    if (linhas.length <= 2) return // sempre sobra cabeçalho + 1 linha
    setLinhas((prev) => prev.filter((_, i) => i !== r))
  }

  function adicionarColuna() {
    setLinhas((prev) => prev.map((linha) => [...linha, '']))
  }

  function removerColuna(c) {
    if ((linhas[0]?.length || 0) <= 1) return
    setLinhas((prev) => prev.map((linha) => linha.filter((_, i) => i !== c)))
  }

  async function salvar() {
    setSalvando(true)
    try {
      await onSalvar({ ...tabela, linhas })
      setEditando(false)
    } finally {
      setSalvando(false)
    }
  }

  // Navegação por teclado entre células — setas movem o foco pela grade.
  function navegar(e, r, c) {
    const mapa = { ArrowUp: [r - 1, c], ArrowDown: [r + 1, c], ArrowLeft: [r, c - 1], ArrowRight: [r, c + 1] }
    const alvo = mapa[e.key]
    if (!alvo) return
    const [nr, nc] = alvo
    const ref = refsCelulas.current[nr]?.[nc]
    if (ref) {
      e.preventDefault()
      ref.focus()
      ref.select?.()
    }
  }

  function registrarRef(r, c, el) {
    if (!refsCelulas.current[r]) refsCelulas.current[r] = []
    refsCelulas.current[r][c] = el
  }

  if (!editando) {
    const [cabecalhoLeitura, ...dadosLeitura] = tabela.linhas
    return (
      <div className="group relative my-3 overflow-x-auto rounded-lg border border-(--color-line)">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {(cabecalhoLeitura || []).map((c, i) => (
                <th key={i} className="border-b border-(--color-line) bg-(--color-canvas) px-2.5 py-1.5 text-left font-semibold text-(--color-ink)">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dadosLeitura.map((linha, r) => (
              <tr key={r}>
                {linha.map((celula, c) => (
                  <td key={c} className="border-b border-(--color-line) px-2.5 py-1.5 text-slate-600">
                    {celula}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {podeEditar && (
          <button
            onClick={iniciarEdicao}
            className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-lg border border-(--color-line) bg-(--color-surface) px-2 py-1 text-[11px] font-semibold text-slate-500 opacity-0 shadow-sm transition group-hover:opacity-100 hover:border-(--color-teal) hover:text-(--color-navy) print:hidden"
          >
            <Pencil size={11} /> Editar tabela
          </button>
        )}
      </div>
    )
  }

  const [cabecalho, ...dados] = linhas

  return (
    <div className="my-3 space-y-2 rounded-xl border border-(--color-teal) bg-(--color-canvas) p-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {cabecalho.map((c, ci) => (
                <th key={ci} className="border border-(--color-line) bg-(--color-surface) p-0.5">
                  <div className="flex items-center gap-0.5">
                    <input
                      ref={(el) => registrarRef(0, ci, el)}
                      value={c}
                      onChange={(e) => mudarCelula(0, ci, e.target.value)}
                      onKeyDown={(e) => navegar(e, 0, ci)}
                      className="w-full min-w-[90px] rounded bg-transparent px-1.5 py-1 text-xs font-semibold text-(--color-ink) outline-none focus:bg-(--color-canvas)"
                    />
                    <button
                      onClick={() => removerColuna(ci)}
                      title="Remover coluna"
                      className="shrink-0 rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-7 border border-(--color-line) bg-(--color-surface)">
                <button onClick={adicionarColuna} title="Adicionar coluna" className="flex w-full items-center justify-center p-1.5 text-slate-400 hover:text-(--color-navy)">
                  <Plus size={13} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {dados.map((linha, ri) => (
              <tr key={ri}>
                {cabecalho.map((_, ci) => (
                  <td key={ci} className="border border-(--color-line) bg-(--color-surface) p-0.5">
                    <input
                      ref={(el) => registrarRef(ri + 1, ci, el)}
                      value={linha[ci] ?? ''}
                      onChange={(e) => mudarCelula(ri + 1, ci, e.target.value)}
                      onKeyDown={(e) => navegar(e, ri + 1, ci)}
                      className="w-full min-w-[90px] rounded bg-transparent px-1.5 py-1 text-xs text-slate-600 outline-none focus:bg-(--color-canvas)"
                    />
                  </td>
                ))}
                <td className="w-7 border border-(--color-line) bg-(--color-surface)">
                  <button
                    onClick={() => removerLinha(ri + 1)}
                    title="Remover linha"
                    className="flex w-full items-center justify-center p-1.5 text-slate-300 hover:text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={adicionarLinha}
          className="flex items-center gap-1 rounded-lg border border-(--color-line) bg-(--color-surface) px-2 py-1 text-xs font-semibold text-slate-500 hover:border-(--color-teal) hover:text-(--color-navy)"
        >
          <Plus size={12} /> Linha
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={cancelar}
            disabled={salvando}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-(--color-surface) disabled:opacity-60"
          >
            <XIcon size={13} /> Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1 rounded-lg bg-(--color-navy) px-3 py-1.5 text-xs font-semibold text-white hover:bg-(--color-navy-light) disabled:opacity-60"
          >
            {salvando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
