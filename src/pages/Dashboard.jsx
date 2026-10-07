// Dashboard — Fase 2F do planejamento. Deixa de ser placeholder (Fase 0.5,
// zerado de propósito) e passa a ser a TELA INICIAL operacional de verdade:
// login → Dashboard → atalhos pros módulos. Não existe uma página "Home"
// separada — este é o home screen.
//
// 100% dados reais (DashboardService) — nenhum número inventado. Cada seção
// busca e trata o próprio erro (ver useSecaoDados) para que uma falha
// isolada nunca derrube o resto da tela.
//
// Atualização simples (sem polling agressivo): um botão "Atualizar" e um
// listener de "voltar à aba" incrementam `refreshKey`, que cada seção usa
// como dependência da própria busca.
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { obterSaudacaoPorHorario } from '../lib/dashboard/DashboardService'
import DashboardKpis from '../components/dashboard/DashboardKpis'
import PainelAtencao from '../components/dashboard/PainelAtencao'
import ResumoPipeline from '../components/dashboard/ResumoPipeline'
import ProximasAcoes from '../components/dashboard/ProximasAcoes'
import ResumoProjetos from '../components/dashboard/ResumoProjetos'
import ResumoTarefas from '../components/dashboard/ResumoTarefas'
import AtividadeRecente from '../components/dashboard/AtividadeRecente'
import AcessosRapidos from '../components/dashboard/AcessosRapidos'

function primeiroNome(nomeCompleto) {
  if (!nomeCompleto) return null
  return nomeCompleto.trim().split(/\s+/)[0]
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)

  const atualizar = useCallback(() => setRefreshKey((k) => k + 1), [])

  // "Atualização simples... ou ao retornar" (item do planejamento) — sem
  // polling: só reage quando a aba volta a ficar visível.
  useEffect(() => {
    function aoFocar() {
      if (document.visibilityState === 'visible') atualizar()
    }
    document.addEventListener('visibilitychange', aoFocar)
    return () => document.removeEventListener('visibilitychange', aoFocar)
  }, [atualizar])

  const nome = primeiroNome(profile?.nome)
  const saudacao = nome ? `${obterSaudacaoPorHorario()}, ${nome}` : 'Olá'
  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold capitalize text-(--color-ink)">{saudacao}</h1>
          <p className="mt-0.5 text-sm capitalize text-(--color-ink-secondary)">{dataHoje}</p>
        </div>
        <button
          type="button"
          onClick={atualizar}
          className="flex items-center gap-1.5 rounded-xl border border-(--color-line) bg-(--color-surface) px-3 py-1.5 text-xs font-semibold text-(--color-ink-secondary) hover:text-(--color-primary)"
        >
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>

      <DashboardKpis refreshKey={refreshKey} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PainelAtencao refreshKey={refreshKey} />
        <ResumoPipeline refreshKey={refreshKey} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProximasAcoes refreshKey={refreshKey} />
        <ResumoProjetos refreshKey={refreshKey} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ResumoTarefas refreshKey={refreshKey} />
        <AtividadeRecente refreshKey={refreshKey} />
        <AcessosRapidos refreshKey={refreshKey} />
      </div>
    </div>
  )
}
