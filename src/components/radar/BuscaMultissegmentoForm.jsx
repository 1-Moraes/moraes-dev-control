// Formulário de busca multissegmento — Fase 3A. Seleção de vários
// segmentos (checkbox) + uma localização só, respeitando o limite definido
// centralmente em segmentosPreset.js. Mostra progresso por segmento
// (pendente/em andamento/sucesso/erro) durante a execução — a orquestração
// de verdade (concorrência controlada, falha parcial) mora em
// src/lib/radar/BuscaMultissegmento.js, este componente só é apresentação.
import { useState } from 'react'
import { Search, CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react'
import { SEGMENTOS_SUGERIDOS, LIMITE_SEGMENTOS_MULTIBUSCA } from '../../lib/radar/segmentosPreset'

const QUANTIDADES = [10, 20, 50]

const ICONE_STATUS = {
  pendente: <Circle size={13} className="text-(--color-ink-secondary)" />,
  em_andamento: <Loader2 size={13} className="animate-spin text-(--color-primary)" />,
  sucesso: <CheckCircle2 size={13} className="text-(--color-green)" />,
  erro: <XCircle size={13} className="text-(--color-danger)" />,
}

export default function BuscaMultissegmentoForm({ onBuscar, buscando, progresso }) {
  const [selecionados, setSelecionados] = useState([])
  const [localizacao, setLocalizacao] = useState('')
  const [quantidade, setQuantidade] = useState(20)

  function alternar(segmento) {
    setSelecionados((atual) => {
      if (atual.includes(segmento)) return atual.filter((s) => s !== segmento)
      if (atual.length >= LIMITE_SEGMENTOS_MULTIBUSCA) return atual
      return [...atual, segmento]
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onBuscar({ segmentos: selecionados, localizacao, quantidade })
      }}
      className="flex flex-col gap-3 rounded-2xl border border-(--color-line) bg-(--color-surface) p-4 shadow-sm"
    >
      <div>
        <p className="mb-1.5 text-xs font-medium text-(--color-ink-secondary)">
          Segmentos (até {LIMITE_SEGMENTOS_MULTIBUSCA}) — {selecionados.length}/{LIMITE_SEGMENTOS_MULTIBUSCA} selecionados
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SEGMENTOS_SUGERIDOS.map((segmento) => {
            const marcado = selecionados.includes(segmento)
            const statusInfo = progresso?.find((p) => p.segmento === segmento)
            return (
              <button
                key={segmento}
                type="button"
                disabled={buscando}
                onClick={() => alternar(segmento)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-70 ${
                  marcado ? 'border-(--color-primary) bg-(--color-primary-bg) text-(--color-primary)' : 'border-(--color-line) text-(--color-ink-secondary) hover:border-(--color-primary-soft)'
                }`}
              >
                {statusInfo ? ICONE_STATUS[statusInfo.status] : null}
                {segmento}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-(--color-ink-secondary)">Localização</label>
          <input
            type="text"
            value={localizacao}
            onChange={(e) => setLocalizacao(e.target.value)}
            placeholder="Cotia, SP"
            maxLength={80}
            className="mt-1 w-full rounded-xl border border-(--color-line) bg-(--color-canvas) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
          />
        </div>
        <div className="sm:w-32">
          <label className="text-xs font-medium text-(--color-ink-secondary)">Quantidade/segmento</label>
          <select
            value={quantidade}
            onChange={(e) => setQuantidade(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-(--color-line) bg-(--color-canvas) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
          >
            {QUANTIDADES.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={buscando || selecionados.length === 0 || !localizacao.trim()}
          className="flex items-center justify-center gap-2 rounded-xl bg-(--color-primary) px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-(--color-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Search size={16} />
          Buscar {selecionados.length > 0 ? `(${selecionados.length})` : ''}
        </button>
      </div>
      <p className="text-[11px] text-(--color-ink-secondary)">
        As buscas rodam em pequenos grupos, uma por vez dentro de cada grupo — não é possível cancelar uma rodada já iniciada.
      </p>
    </form>
  )
}
