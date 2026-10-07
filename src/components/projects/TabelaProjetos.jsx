// Listagem/tabela de Projetos — item 20 do planejamento da Fase 2D. Só a
// lista (sem Kanban — gestão operacional completa é Fase 2E).
import { useMemo, useState } from 'react'
import { ArrowUpDown, Search } from 'lucide-react'
import { STATUS_PROJETO, STATUS_PROJETO_LABEL, PRIORIDADES_PROJETO } from '../../lib/projects/ProjectsService'

const COLUNAS = [
  { chave: 'nome', label: 'Projeto' },
  { chave: 'cliente', label: 'Cliente' },
  { chave: 'servico', label: 'Serviço' },
  { chave: 'status', label: 'Status' },
  { chave: 'prioridade', label: 'Prioridade' },
  { chave: 'responsavel', label: 'Responsável' },
  { chave: 'data_inicio', label: 'Início' },
  { chave: 'prazo_previsto', label: 'Prazo' },
]

function valorOrdenavel(p, chave) {
  if (chave === 'cliente') return p.cliente?.nome_empresa || ''
  if (chave === 'servico') return p.servico?.nome || ''
  if (chave === 'responsavel') return p.responsavel?.nome || ''
  return p[chave] || ''
}

export default function TabelaProjetos({ projetos, onAbrirProjeto }) {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('')
  const [ordenacao, setOrdenacao] = useState({ chave: 'data_inicio', asc: false })

  const clientesUnicos = useMemo(
    () => [...new Map(projetos.filter((p) => p.cliente).map((p) => [p.cliente.id, p.cliente])).values()].sort((a, b) => a.nome_empresa.localeCompare(b.nome_empresa, 'pt-BR')),
    [projetos]
  )

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    let resultado = projetos.filter((p) => {
      if (termo && !`${p.nome} ${p.cliente?.nome_empresa || ''}`.toLowerCase().includes(termo)) return false
      if (filtroStatus && p.status !== filtroStatus) return false
      if (filtroCliente && p.client_id !== filtroCliente) return false
      if (filtroPrioridade && p.prioridade !== filtroPrioridade) return false
      return true
    })
    resultado = [...resultado].sort((a, b) => {
      const va = valorOrdenavel(a, ordenacao.chave)
      const vb = valorOrdenavel(b, ordenacao.chave)
      const cmp = String(va).localeCompare(String(vb), 'pt-BR', { numeric: true })
      return ordenacao.asc ? cmp : -cmp
    })
    return resultado
  }, [projetos, busca, filtroStatus, filtroCliente, filtroPrioridade, ordenacao])

  function alternarOrdenacao(chave) {
    setOrdenacao((atual) => (atual.chave === chave ? { chave, asc: !atual.asc } : { chave, asc: true }))
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-(--color-ink-secondary)" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar projeto ou cliente..."
            className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) py-1.5 pl-8 pr-3 text-xs text-(--color-ink) outline-none focus:border-(--color-primary)"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="rounded-lg border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-xs text-(--color-ink) outline-none"
        >
          <option value="">Todos os status</option>
          {STATUS_PROJETO.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={filtroPrioridade}
          onChange={(e) => setFiltroPrioridade(e.target.value)}
          className="rounded-lg border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-xs text-(--color-ink) outline-none"
        >
          <option value="">Toda prioridade</option>
          {PRIORIDADES_PROJETO.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.label}
            </option>
          ))}
        </select>
        {clientesUnicos.length > 0 ? (
          <select
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="rounded-lg border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-xs text-(--color-ink) outline-none"
          >
            <option value="">Todo cliente</option>
            {clientesUnicos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome_empresa}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto rounded-2xl border border-(--color-line)">
        <table className="min-w-full divide-y divide-(--color-line) text-left text-xs">
          <thead className="sticky top-0 bg-(--color-canvas)">
            <tr>
              {COLUNAS.map((col) => (
                <th key={col.chave} className="whitespace-nowrap px-3 py-2 font-semibold text-(--color-ink-secondary)">
                  <button type="button" onClick={() => alternarOrdenacao(col.chave)} className="flex items-center gap-1 hover:text-(--color-ink)">
                    {col.label}
                    <ArrowUpDown size={10} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-(--color-line) bg-(--color-surface)">
            {filtrados.map((p) => (
              <tr key={p.id} onClick={() => onAbrirProjeto(p)} className="cursor-pointer hover:bg-(--color-canvas)">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-(--color-ink)">{p.nome}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{p.cliente?.nome_empresa || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{p.servico?.nome || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{STATUS_PROJETO_LABEL[p.status] || p.status}</td>
                <td className="whitespace-nowrap px-3 py-2 capitalize text-(--color-ink-secondary)">{p.prioridade}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{p.responsavel?.nome || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{p.data_inicio ? new Date(p.data_inicio).toLocaleDateString('pt-BR') : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{p.prazo_previsto ? new Date(p.prazo_previsto).toLocaleDateString('pt-BR') : '—'}</td>
              </tr>
            ))}
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={COLUNAS.length} className="px-3 py-8 text-center text-(--color-ink-secondary)">
                  Nenhum projeto encontrado com esses filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
