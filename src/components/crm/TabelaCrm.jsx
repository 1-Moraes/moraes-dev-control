// Visualização em tabela do CRM — item 10 do planejamento da Fase 2C.
import { useMemo, useState } from 'react'
import { ArrowUpDown, Search } from 'lucide-react'
import { STATUS_LABEL, STATUS_PIPELINE, PROXIMA_ACAO_TIPOS } from '../../lib/crm/LeadsService'

const COLUNAS = [
  { chave: 'nome_empresa', label: 'Empresa' },
  { chave: 'categoria', label: 'Segmento' },
  { chave: 'cidade', label: 'Cidade' },
  { chave: 'telefone', label: 'Telefone' },
  { chave: 'website', label: 'Website' },
  { chave: 'status', label: 'Status' },
  { chave: 'prioridade', label: 'Prioridade' },
  { chave: 'proxima_acao', label: 'Próxima ação' },
  { chave: 'responsavel', label: 'Responsável' },
  { chave: 'updated_at', label: 'Última atividade' },
]

function valorOrdenavel(lead, chave) {
  if (chave === 'responsavel') return lead.responsavel?.nome || ''
  if (chave === 'proxima_acao') return lead.proxima_acao_data || ''
  return lead[chave] || ''
}

export default function TabelaCrm({ leads, onAbrirLead }) {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('')
  const [filtroCidade, setFiltroCidade] = useState('')
  const [ordenacao, setOrdenacao] = useState({ chave: 'updated_at', asc: false })

  const cidades = useMemo(() => [...new Set(leads.map((l) => l.cidade).filter(Boolean))].sort(), [leads])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    let resultado = leads.filter((l) => {
      if (termo && !`${l.nome_empresa} ${l.categoria || ''}`.toLowerCase().includes(termo)) return false
      if (filtroStatus && l.status !== filtroStatus) return false
      if (filtroPrioridade && l.prioridade !== filtroPrioridade) return false
      if (filtroCidade && l.cidade !== filtroCidade) return false
      return true
    })
    resultado = [...resultado].sort((a, b) => {
      const va = valorOrdenavel(a, ordenacao.chave)
      const vb = valorOrdenavel(b, ordenacao.chave)
      const cmp = String(va).localeCompare(String(vb), 'pt-BR')
      return ordenacao.asc ? cmp : -cmp
    })
    return resultado
  }, [leads, busca, filtroStatus, filtroPrioridade, filtroCidade, ordenacao])

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
            placeholder="Buscar por empresa ou segmento..."
            className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) py-1.5 pl-8 pr-3 text-xs text-(--color-ink) outline-none focus:border-(--color-primary)"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="rounded-lg border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-xs text-(--color-ink) outline-none"
        >
          <option value="">Todos os status</option>
          {STATUS_PIPELINE.map((s) => (
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
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
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
            {filtrados.map((lead) => (
              <tr key={lead.id} onClick={() => onAbrirLead(lead)} className="cursor-pointer hover:bg-(--color-canvas)">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-(--color-ink)">{lead.nome_empresa}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{lead.categoria || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{lead.cidade || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{lead.telefone || '—'}</td>
                <td className="max-w-[10rem] truncate px-3 py-2 text-(--color-ink-secondary)">{lead.website || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{STATUS_LABEL[lead.status] || lead.status}</td>
                <td className="whitespace-nowrap px-3 py-2 capitalize text-(--color-ink-secondary)">{lead.prioridade}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">
                  {PROXIMA_ACAO_TIPOS.find((t) => t.valor === lead.proxima_acao_tipo)?.label || '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">{lead.responsavel?.nome || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-secondary)">
                  {new Date(lead.updated_at).toLocaleDateString('pt-BR')}
                </td>
              </tr>
            ))}
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={COLUNAS.length} className="px-3 py-8 text-center text-(--color-ink-secondary)">
                  Nenhum lead encontrado com esses filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
