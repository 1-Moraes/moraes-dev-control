// Listagem/tabela de Clientes — item 12 do planejamento da Fase 2D.
import { useMemo, useState } from 'react'
import { ArrowUpDown, Search } from 'lucide-react'
import { STATUS_CLIENTE } from '../../lib/clients/ClientsService'

const COLUNAS = [
  { chave: 'nome_empresa', label: 'Cliente' },
  { chave: 'segmento', label: 'Segmento' },
  { chave: 'cidade', label: 'Cidade' },
  { chave: 'telefone', label: 'Telefone' },
  { chave: 'website', label: 'Website' },
  { chave: 'status', label: 'Status' },
  { chave: 'projetos', label: 'Projetos' },
  { chave: 'responsavel', label: 'Responsável' },
  { chave: 'data_inicio_relacionamento', label: 'Desde' },
]

const STATUS_LABEL = Object.fromEntries(STATUS_CLIENTE.map((s) => [s.valor, s.label]))

function valorOrdenavel(cliente, chave) {
  if (chave === 'responsavel') return cliente.responsavel?.nome || ''
  if (chave === 'projetos') return cliente.projetos_count ?? 0
  return cliente[chave] || ''
}

export default function TabelaClientes({ clientes, onAbrirCliente }) {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCidade, setFiltroCidade] = useState('')
  const [ordenacao, setOrdenacao] = useState({ chave: 'data_inicio_relacionamento', asc: false })

  const cidades = useMemo(() => [...new Set(clientes.map((c) => c.cidade).filter(Boolean))].sort(), [clientes])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    let resultado = clientes.filter((c) => {
      if (termo && !`${c.nome_empresa} ${c.segmento || ''}`.toLowerCase().includes(termo)) return false
      if (filtroStatus && c.status !== filtroStatus) return false
      if (filtroCidade && c.cidade !== filtroCidade) return false
      return true
    })
    resultado = [...resultado].sort((a, b) => {
      const va = valorOrdenavel(a, ordenacao.chave)
      const vb = valorOrdenavel(b, ordenacao.chave)
      const cmp = String(va).localeCompare(String(vb), 'pt-BR', { numeric: true })
      return ordenacao.asc ? cmp : -cmp
    })
    return resultado
  }, [clientes, busca, filtroStatus, filtroCidade, ordenacao])

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
            placeholder="Buscar cliente..."
            className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) py-1.5 pl-8 pr-3 text-xs text-(--color-ink) outline-none focus:border-(--color-primary)"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="rounded-lg border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-xs text-(--color-ink) outline-none"
        >
          <option value="">Todos os status</option>
          {STATUS_CLIENTE.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.label}
            </option>
          ))}
        </select>
        {cidades.length > 0 ? (
          <select
            value={filtroCidade}
            onChange={(e) => setFiltroCidade(e.target.value)}
            className="rounded-lg border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-xs text-(--color-ink) outline-none"
          >
            <option value="">Toda cidade</option>
            {cidades.map((c) => (
              <option key={c} value={c}>
                {c}
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
            {filtrados.map((cliente) => (
              <tr key={cliente.id} onClick={() => onAbrirCliente(cliente)} className="cursor-pointer hover:bg-(--color-canvas)">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-(--color-ink)">{cliente.nome_empresa}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{cliente.segmento || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{cliente.cidade || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{cliente.telefone || '—'}</td>
                <td className="max-w-[10rem] truncate px-3 py-2 text-(--color-ink-secondary)">{cliente.website || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{STATUS_LABEL[cliente.status] || cliente.status}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{cliente.projetos_count ?? 0}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{cliente.responsavel?.nome || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">
                  {cliente.data_inicio_relacionamento ? new Date(cliente.data_inicio_relacionamento).toLocaleDateString('pt-BR') : '—'}
                </td>
              </tr>
            ))}
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={COLUNAS.length} className="px-3 py-8 text-center text-(--color-ink-secondary)">
                  Nenhum cliente encontrado com esses filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
