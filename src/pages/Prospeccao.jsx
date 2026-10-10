// Radar de Prospecção — Fase 2B (MVP), Fase 2F (Dashboard/continuidade) e
// Fase 3A (Inteligência: WebsiteAnalyzer + Opportunity Score + busca
// multissegmento). Arquitetura completa:
//
//   Prospeccao.jsx (esta tela)
//        ↓ fetch('/api/radar-buscar')  (uma chamada por segmento)
//   Radar Service/API (api/radar-buscar.js)
//        ↓
//   DiscoveryService → DiscoveryProvider → OpenStreetMapProvider (real,
//        ↓                                  dinâmico — padrão desde a Fase 3A)
//   Normalizer → Deduplicator → resultado normalizado
//        ↓
//   WebsiteAnalyzer (classifica presença digital) + OpportunityScore
//   (pontua) — Fase 3A, SEM IA, 100% determinístico — ver
//   src/lib/radar/WebsiteAnalyzer.js e OpportunityScore.js.
//
// Esta tela NÃO conhece o provider nem o formato bruto do scraper — só o
// contrato JSON devolvido pelo endpoint. Troca de provider não exige tocar
// neste arquivo.
//
// "Resultado de busca" vs. "candidato selecionado" (item 12 do
// planejamento): resultados ficam só em memória/estado do componente, MAS a
// Fase 2F acrescenta um CACHE da última busca no localStorage (ver
// CHAVE_CACHE_BUSCA abaixo), expandido na Fase 3A pra também guardar
// correções manuais de presença digital feitas num candidato ainda não
// enviado ao CRM — só para não perder a última pesquisa/análise ao
// recarregar a página, nunca como substituto de uma busca ao vivo.
// "Candidatos selecionados" continuam persistindo no localStorage do
// navegador (por sessão de quem está usando, não sincronizado entre
// pessoas/dispositivos e NUNCA gravado no Supabase de leads/clientes nesta
// fase — ver item 15).
//
// Análise (score/presença) de um candidato do Radar que AINDA não é lead no
// CRM vive só em memória/cache deste componente — só quando o candidato é
// efetivamente enviado ao CRM ("Adicionar ao CRM") é que a análise persiste
// de verdade (colunas novas em `leads` + uma linha em `lead_analysis`, ver
// LeadsService.js). Isso é uma consequência direta de `lead_analysis.lead_id`
// ser NOT NULL — uma linha de análise não pode existir sem um lead real.

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, Loader2, CheckCircle2, History, RotateCcw, Sparkles, AlertTriangle } from 'lucide-react'
import BarraBusca from '../components/radar/BarraBusca'
import BuscaMultissegmentoForm from '../components/radar/BuscaMultissegmentoForm'
import FiltrosOportunidade from '../components/radar/FiltrosOportunidade'
import EstadoBusca from '../components/radar/EstadoBusca'
import CardLead from '../components/radar/CardLead'
import DrawerDetalhesLead from '../components/radar/DrawerDetalhesLead'
import DrawerAnaliseLead from '../components/radar/DrawerAnaliseLead'
import ModalDuplicataCrm from '../components/radar/ModalDuplicataCrm'
import { criarLeadDoRadar, verificarDuplicatasEmLote, registrarPresencaManual, registrarNovaAnalise } from '../lib/crm/LeadsService'
import { classificarPresencaDigital } from '../lib/radar/WebsiteAnalyzer'
import { calcularOpportunityScore } from '../lib/radar/OpportunityScore'
import { deduplicar } from '../lib/radar/Deduplicator'
import { executarBuscaMultissegmento, unificarResultadosMultissegmento } from '../lib/radar/BuscaMultissegmento'

// maplibre-gl é uma lib pesada (~190kB gzip) — carregada só quando a tela
// de Prospecção de fato renderiza o mapa, via code-splitting, em vez de
// entrar no bundle principal de todas as páginas do Control.
const MapaResultados = lazy(() => import('../components/radar/MapaResultados'))

const CHAVE_CANDIDATOS = 'moraes_dev_control_radar_candidatos_v1'

// ----------------------------------------------------------------------------
// Cache da última pesquisa (Fase 2F) + correções manuais de presença digital
// (Fase 3A) — SÓ isso: a última busca, nunca um histórico. VERSÃO 2 (Fase
// 3A): formato ampliado para também guardar `overrides` (correções manuais
// por lead.id, só pra candidatos ainda não enviados ao CRM) e o `modo` da
// busca (simples|multissegmento). Um cache de versão antiga (1) ou
// corrompido é tratado como "sem cache" e limpo silenciosamente — NUNCA
// quebra a tela (mesma disciplina defensiva da Fase 2F, só estendida).
// ----------------------------------------------------------------------------
const CHAVE_CACHE_BUSCA = 'moraes_dev_control_radar_ultima_busca_v2'
const VERSAO_CACHE_BUSCA = 2
const TTL_CACHE_BUSCA_MS = 24 * 60 * 60 * 1000

function carregarCacheBusca() {
  try {
    const bruto = localStorage.getItem(CHAVE_CACHE_BUSCA)
    if (!bruto) return null
    const cache = JSON.parse(bruto)
    if (
      !cache ||
      cache.version !== VERSAO_CACHE_BUSCA ||
      typeof cache.savedAt !== 'string' ||
      !cache.query ||
      !cache.results ||
      !Array.isArray(cache.results.resultados)
    ) {
      localStorage.removeItem(CHAVE_CACHE_BUSCA)
      return null
    }
    const idadeMs = Date.now() - new Date(cache.savedAt).getTime()
    if (Number.isNaN(idadeMs)) {
      localStorage.removeItem(CHAVE_CACHE_BUSCA)
      return null
    }
    return { ...cache, overrides: cache.overrides || {}, expirado: idadeMs > TTL_CACHE_BUSCA_MS }
  } catch {
    try {
      localStorage.removeItem(CHAVE_CACHE_BUSCA)
    } catch {
      /* localStorage indisponível — nada a fazer, segue sem cache */
    }
    return null
  }
}

function salvarCacheBusca({ modo, query, results, overrides }) {
  try {
    localStorage.setItem(
      CHAVE_CACHE_BUSCA,
      JSON.stringify({ version: VERSAO_CACHE_BUSCA, savedAt: new Date().toISOString(), modo, query, results, overrides })
    )
  } catch {
    /* localStorage indisponível (modo privado etc.) — degrada em silêncio */
  }
}

function limparCacheBusca() {
  try {
    localStorage.removeItem(CHAVE_CACHE_BUSCA)
  } catch {
    /* idem */
  }
}

// Também removemos, de propósito, a chave da versão 1 (Fase 2F) se ainda
// existir no navegador de alguém — evita deixar lixo órfão que nunca mais é
// lido, sem nenhum risco (era só a última busca, já substituída por este
// novo formato).
function limparCacheVersaoAntiga() {
  try {
    localStorage.removeItem('moraes_dev_control_radar_ultima_busca_v1')
  } catch {
    /* idem */
  }
}

function carregarCandidatos() {
  try {
    const bruto = localStorage.getItem(CHAVE_CANDIDATOS)
    return bruto ? new Set(JSON.parse(bruto)) : new Set()
  } catch {
    return new Set()
  }
}

function salvarCandidatos(set) {
  try {
    localStorage.setItem(CHAVE_CANDIDATOS, JSON.stringify([...set]))
  } catch {
    /* localStorage indisponível (modo privado etc.) — degrada em silêncio, não é crítico */
  }
}

const FILTROS_CRM = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'nao_enviados', label: 'Ainda não enviados' },
  { valor: 'no_crm', label: 'Já no CRM' },
]

export default function Prospeccao() {
  const navigate = useNavigate()
  const [modoBusca, setModoBusca] = useState('simples') // simples|multissegmento
  const [form, setForm] = useState({ segmento: '', localizacao: '', quantidade: 20 })
  const [estado, setEstado] = useState('inicial') // inicial|buscando|normalizando|sucesso|sem_resultado|sem_cobertura|indisponivel|erro|bloqueio
  const [resultado, setResultado] = useState(null)
  const [progressoMultissegmento, setProgressoMultissegmento] = useState(null) // [{segmento,status}]
  const [restauradoDoCache, setRestauradoDoCache] = useState(null) // { savedAt, expirado } | null
  const [abaMobile, setAbaMobile] = useState('lista') // lista|mapa
  const [selecionadoId, setSelecionadoId] = useState(null)
  const [leadDetalhe, setLeadDetalhe] = useState(null)
  const [leadAnalise, setLeadAnalise] = useState(null) // lead atualmente aberto no painel "Ver análise"
  const [salvandoPresenca, setSalvandoPresenca] = useState(false)
  const [candidatos, setCandidatos] = useState(() => carregarCandidatos())
  const [filtroCrm, setFiltroCrm] = useState('todos')
  const [filtroOportunidade, setFiltroOportunidade] = useState('todos')
  const [ordenacao, setOrdenacao] = useState('maior_score')
  // Correções manuais de presença digital de candidatos AINDA não enviados
  // ao CRM — chave = lead.id (sourceId/tmp-N do Radar), valor = patch
  // { confirmacao, siteUrlManual, instagramUrl, facebookUrl }. Persistido no
  // mesmo cache da última busca (ver salvarCacheBusca). Uma vez enviado ao
  // CRM, a correção passa a morar em `leads`/`lead_analysis` — ver
  // LeadsService.criarLeadDoRadar.
  const [overrides, setOverrides] = useState({})

  // Fase 2C/2F — integração Radar → CRM, ver notas originais mantidas.
  const [crmMatches, setCrmMatches] = useState(() => new Map())
  const [verificandoCrm, setVerificandoCrm] = useState(false)
  const [enviandoCrmId, setEnviandoCrmId] = useState(null)
  const [duplicataInfo, setDuplicataInfo] = useState(null) // { lead, leadExistente, sinal }
  const [confirmacaoCrm, setConfirmacaoCrm] = useState(null) // { leadId, leadCriadoId }
  const [erroCrm, setErroCrm] = useState(null)

  useEffect(() => {
    salvarCandidatos(candidatos)
  }, [candidatos])

  // Restaura a última pesquisa do cache SÓ na primeira renderização.
  useEffect(() => {
    limparCacheVersaoAntiga()
    const cache = carregarCacheBusca()
    if (!cache) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura o estado da última pesquisa a partir do localStorage, só uma vez, ao montar a tela
    setModoBusca(cache.modo || 'simples')
    setForm(cache.query)
    setResultado(cache.results)
    setOverrides(cache.overrides || {})
    setEstado(cache.results.resultados?.length ? 'sucesso' : 'sem_resultado')
    setRestauradoDoCache({ savedAt: cache.savedAt, expirado: cache.expirado })
  }, [])

  // "Já no CRM" — reconciliação contra o Supabase real sempre que a lista
  // de resultados muda (busca nova OU restaurada do cache).
  useEffect(() => {
    let vivo = true
    Promise.resolve()
      .then(() => {
        if (!vivo) return undefined
        const leads = resultado?.resultados
        if (!leads?.length) {
          setCrmMatches(new Map())
          return undefined
        }
        setVerificandoCrm(true)
        return verificarDuplicatasEmLote(leads)
      })
      .then((mapa) => {
        if (vivo && mapa) {
          setCrmMatches(new Map([...mapa].map(([radarId, info]) => [radarId, info.leadId])))
        }
      })
      .catch(() => {
        if (vivo) setCrmMatches(new Map())
      })
      .finally(() => {
        if (vivo) setVerificandoCrm(false)
      })
    return () => {
      vivo = false
    }
  }, [resultado])

  async function adicionarAoCrm(lead, { forcar = false } = {}) {
    setErroCrm(null)
    setEnviandoCrmId(lead.id)
    try {
      const resultadoEnvio = await criarLeadDoRadar(lead, { forcar })
      if (resultadoEnvio.duplicata) {
        setDuplicataInfo({ lead, leadExistente: resultadoEnvio.leadExistente, sinal: resultadoEnvio.sinal })
        return
      }
      setDuplicataInfo(null)
      setCrmMatches((atual) => new Map(atual).set(lead.id, resultadoEnvio.lead.id))
      setConfirmacaoCrm({ leadId: lead.id, leadCriadoId: resultadoEnvio.lead.id })
    } catch {
      setErroCrm('Não foi possível adicionar este lead ao CRM agora. Tente novamente em instantes.')
    } finally {
      setEnviandoCrmId(null)
    }
  }

  function aplicarResultado(modo, query, dados) {
    if (!dados?.resultados?.length) {
      setEstado('sem_resultado')
      limparCacheBusca()
      return
    }
    setResultado(dados)
    setEstado('sucesso')
    setOverrides({})
    salvarCacheBusca({ modo, query, results: dados, overrides: {} })
  }

  async function executarBuscaSimples(parametros) {
    setModoBusca('simples')
    setEstado('buscando')
    setResultado(null)
    setRestauradoDoCache(null)
    setSelecionadoId(null)
    setProgressoMultissegmento(null)

    try {
      const resp = await fetch('/api/radar-buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parametros),
      })
      const dados = await resp.json()

      setEstado('normalizando')
      await new Promise((r) => setTimeout(r, 200))

      // Ajuste da Fase 3A (item 14): "sem resultado" (fonte funcionou, nada
      // encontrado), "sem cobertura" (fonte não reconhece essa localização/
      // combinação) e "indisponível" (não deu pra consultar a fonte agora)
      // são estados DIFERENTES — nunca mostrados com a mesma mensagem.
      if (!resp.ok || dados.status === 'erro') {
        setEstado('erro')
        return
      }
      if (['bloqueio', 'sem_cobertura', 'indisponivel'].includes(dados.status)) {
        setEstado(dados.status)
        limparCacheBusca()
        return
      }
      aplicarResultado('simples', parametros, dados)
    } catch {
      setEstado('erro')
    }
  }

  // Busca multissegmento (Fase 3A) — uma chamada a /api/radar-buscar por
  // segmento, concorrência controlada (ver BuscaMultissegmento.js), nunca
  // todas de uma vez. Falha parcial preserva os segmentos que funcionaram.
  async function executarBuscaMultissegmentoUI({ segmentos, localizacao, quantidade }) {
    setModoBusca('multissegmento')
    setEstado('buscando')
    setResultado(null)
    setRestauradoDoCache(null)
    setSelecionadoId(null)
    setProgressoMultissegmento(segmentos.map((segmento) => ({ segmento, status: 'pendente' })))

    const executarUmSegmento = async (segmento) => {
      const resp = await fetch('/api/radar-buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmento, localizacao, quantidade }),
      })
      const dados = await resp.json()
      // 'erro'/'bloqueio'/'indisponivel' contam como falha DESTE segmento
      // (não descartam os outros, ver executarBuscaMultissegmento); 'sem_
      // resultado'/'sem_cobertura' são execuções bem-sucedidas que só não
      // acharam nada — nunca tratadas como falha.
      if (!resp.ok || ['erro', 'bloqueio', 'indisponivel'].includes(dados.status)) {
        throw new Error(dados.mensagemErro || 'Falha na busca deste segmento.')
      }
      return dados
    }

    const porSegmento = await executarBuscaMultissegmento(segmentos, executarUmSegmento, (p) => {
      setProgressoMultissegmento((atual) => {
        const novo = [...(atual || [])]
        novo[p.indice] = { segmento: p.segmento, status: p.status }
        return novo
      })
    })

    setEstado('normalizando')
    await new Promise((r) => setTimeout(r, 150))

    const sucesso = porSegmento.filter((r) => r.status === 'sucesso')
    if (sucesso.length === 0) {
      setEstado('erro')
      return
    }

    const unificados = unificarResultadosMultissegmento(porSegmento)
    // Reusa o MESMO Deduplicator do Radar — nunca um algoritmo paralelo —
    // pra marcar possíveis duplicatas entre segmentos diferentes (ex.: o
    // mesmo negócio listado em "Salões de beleza" e "Clínicas de estética").
    const { leads: dedupicados, gruposDuplicados } = deduplicar(unificados)

    const totalDedup = dedupicados.length || 1 // evita divisão por zero quando todos os segmentos vieram vazios
    const cobertura = {
      telefone: Math.round((dedupicados.filter((l) => l.phone).length / totalDedup) * 1000) / 10,
      website: Math.round((dedupicados.filter((l) => l.website).length / totalDedup) * 1000) / 10,
      coordenadas: Math.round((dedupicados.filter((l) => l.latitude && l.longitude).length / totalDedup) * 1000) / 10,
    }

    const dadosUnificados = {
      status: 'sucesso',
      quantidadeAposNormalizacao: dedupicados.length,
      resultados: dedupicados,
      gruposDuplicados,
      cobertura,
      segmentosComFalha: porSegmento.filter((r) => r.status === 'erro').map((r) => ({ segmento: r.segmento, erro: r.erro })),
      segmentosOk: sucesso.length,
      segmentosTotal: porSegmento.length,
    }

    aplicarResultado('multissegmento', { segmentos, localizacao, quantidade }, dadosUnificados)
  }

  function buscar() {
    return executarBuscaSimples(form)
  }

  // "[Nova pesquisa]" — limpa resultados, seleção atual na tela e o cache;
  // reseta o formulário. NUNCA apaga os `candidatos` persistidos nem
  // qualquer dado do CRM.
  function novaPesquisa() {
    setForm({ segmento: '', localizacao: '', quantidade: 20 })
    setResultado(null)
    setEstado('inicial')
    setSelecionadoId(null)
    setRestauradoDoCache(null)
    setCrmMatches(new Map())
    setFiltroCrm('todos')
    setFiltroOportunidade('todos')
    setOverrides({})
    setProgressoMultissegmento(null)
    limparCacheBusca()
  }

  // "Pesquisar novamente" (item 3A: deve refazer a DESCOBERTA e a ANÁLISE,
  // nunca só reler o cache) — refaz a mesma consulta (simples ou
  // multissegmento) já salva no form/cache.
  function pesquisarNovamente() {
    if (modoBusca === 'multissegmento' && resultado) {
      return executarBuscaMultissegmentoUI(form)
    }
    return executarBuscaSimples(form)
  }

  function alternarCandidato(leadId) {
    setCandidatos((anterior) => {
      const novo = new Set(anterior)
      if (novo.has(leadId)) novo.delete(leadId)
      else novo.add(leadId)
      return novo
    })
  }

  // Aplica a correção manual (override) a um candidato ainda não enviado ao
  // CRM, OU persiste de verdade se o lead já está no CRM — e recalcula o
  // score imediatamente nos dois casos (correção manual nunca espera um
  // próximo reload pra refletir no score).
  async function salvarPresencaManual(lead, patch) {
    const crmLeadId = crmMatches.get(lead.id)
    if (crmLeadId) {
      setSalvandoPresenca(true)
      try {
        await registrarPresencaManual(crmLeadId, patch)
        const presenca = classificarPresencaDigital({
          website: lead.website,
          siteUrlManual: patch.siteUrlManual,
          instagramUrlManual: patch.instagramUrl,
          facebookUrlManual: patch.facebookUrl,
          confirmacaoManual: patch.confirmacao,
        })
        const novaAnalise = calcularOpportunityScore(lead, presenca)
        await registrarNovaAnalise(crmLeadId, novaAnalise)
      } catch {
        setErroCrm('Não foi possível salvar a correção manual agora. Tente novamente em instantes.')
      } finally {
        setSalvandoPresenca(false)
      }
    }
    setOverrides((atual) => {
      const novo = {
        ...atual,
        [lead.id]: { confirmacao: patch.confirmacao, siteUrlManual: patch.siteUrlManual, instagramUrl: patch.instagramUrl, facebookUrl: patch.facebookUrl },
      }
      if (resultado) salvarCacheBusca({ modo: modoBusca, query: form, results: resultado, overrides: novo })
      return novo
    })
  }

  // Anexa classificação de presença + Opportunity Score a cada lead —
  // SEMPRE recalculado aqui (nunca persistido em cache como "verdade"), a
  // partir dos dados da busca + qualquer override manual desta sessão.
  const leadsAnalisados = useMemo(() => {
    const todosLeads = resultado?.resultados || []
    return todosLeads.map((lead) => {
      const override = overrides[lead.id]
      const presenca = classificarPresencaDigital({
        website: lead.website,
        siteUrlManual: override?.siteUrlManual,
        instagramUrlManual: override?.instagramUrl,
        facebookUrlManual: override?.facebookUrl,
        confirmacaoManual: override?.confirmacao || 'nao_confirmado',
      })
      const analise = calcularOpportunityScore(lead, presenca)
      return { ...lead, ...override, analise }
    })
  }, [resultado, overrides])

  const leadsFiltrados = useMemo(() => {
    let lista = leadsAnalisados.filter((lead) => {
      if (filtroCrm === 'no_crm') return crmMatches.has(lead.id)
      if (filtroCrm === 'nao_enviados') return !crmMatches.has(lead.id)
      return true
    })

    lista = lista.filter((lead) => {
      const cat = lead.analise.presenca.categoria
      if (filtroOportunidade === 'melhores') return lead.analise.score >= 60
      if (filtroOportunidade === 'sem_site') return cat !== 'site_proprio_identificado'
      if (filtroOportunidade === 'instagram_sem_site') return cat === 'rede_social_identificada'
      return true
    })

    const porScoreDesc = (a, b) => b.analise.score - a.analise.score
    const ordenadores = {
      maior_score: porScoreDesc,
      menor_score: (a, b) => a.analise.score - b.analise.score,
      mais_avaliacoes: (a, b) => (b.reviewCount || 0) - (a.reviewCount || 0),
      melhor_avaliacao: (a, b) => (b.rating || 0) - (a.rating || 0),
    }
    return [...lista].sort(ordenadores[ordenacao] || porScoreDesc)
  }, [leadsAnalisados, filtroCrm, filtroOportunidade, ordenacao, crmMatches])

  const leadAnaliseAtual = leadAnalise ? leadsAnalisados.find((l) => l.id === leadAnalise.id) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-(--color-ink)">Radar de Prospecção</h1>
          <p className="mt-0.5 text-sm text-(--color-ink-secondary)">
            Busca experimental de empresas por segmento e localização, com análise de oportunidade e visualização em lista e mapa.
          </p>
        </div>
        {['sucesso', 'sem_resultado', 'sem_cobertura', 'indisponivel', 'erro', 'bloqueio'].includes(estado) ? (
          <button
            type="button"
            onClick={novaPesquisa}
            className="flex items-center gap-1.5 rounded-xl border border-(--color-line) bg-(--color-surface) px-3 py-1.5 text-xs font-semibold text-(--color-ink-secondary) hover:text-(--color-primary)"
          >
            <RotateCcw size={13} /> Nova pesquisa
          </button>
        ) : null}
      </div>

      <div className="flex gap-2">
        {[
          { valor: 'simples', label: 'Busca simples' },
          { valor: 'multissegmento', label: 'Buscar vários segmentos' },
        ].map((m) => (
          <button
            key={m.valor}
            type="button"
            onClick={() => setModoBusca(m.valor)}
            disabled={estado === 'buscando' || estado === 'normalizando'}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
              modoBusca === m.valor ? 'bg-(--color-primary) text-white' : 'border border-(--color-line) text-(--color-ink-secondary)'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {modoBusca === 'simples' ? (
        <BarraBusca
          segmento={form.segmento}
          localizacao={form.localizacao}
          quantidade={form.quantidade}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onBuscar={buscar}
          buscando={estado === 'buscando' || estado === 'normalizando'}
        />
      ) : (
        <BuscaMultissegmentoForm onBuscar={executarBuscaMultissegmentoUI} buscando={estado === 'buscando' || estado === 'normalizando'} progresso={progressoMultissegmento} />
      )}

      {restauradoDoCache ? (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
            restauradoDoCache.expirado
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-700'
              : 'border-(--color-line) bg-(--color-canvas) text-(--color-ink-secondary)'
          }`}
        >
          <History size={13} className="shrink-0" />
          Última pesquisa restaurada ({new Date(restauradoDoCache.savedAt).toLocaleString('pt-BR')})
          {restauradoDoCache.expirado ? ' — pode estar desatualizada' : ''}.
          <button type="button" onClick={pesquisarNovamente} className="ml-auto flex items-center gap-1 font-semibold text-(--color-primary) hover:underline">
            <Sparkles size={12} /> Pesquisar novamente
          </button>
        </div>
      ) : null}

      {estado === 'sucesso' && resultado ? (
        <div className="flex flex-wrap items-center gap-3 text-xs text-(--color-ink-secondary)">
          <span className="font-semibold text-(--color-ink)">
            {resultado.quantidadeAposNormalizacao} empresa{resultado.quantidadeAposNormalizacao === 1 ? '' : 's'}{' '}
            encontrada{resultado.quantidadeAposNormalizacao === 1 ? '' : 's'}.
          </span>
          {resultado.segmentosTotal ? (
            <span className={resultado.segmentosOk < resultado.segmentosTotal ? 'font-semibold text-(--color-amber)' : ''}>
              {resultado.segmentosOk} de {resultado.segmentosTotal} buscas concluídas
              {resultado.segmentosComFalha?.length ? ` (falhou: ${resultado.segmentosComFalha.map((f) => f.segmento).join(', ')})` : ''}.
            </span>
          ) : null}
          {resultado.gruposDuplicados?.length ? (
            <span>{resultado.gruposDuplicados.length} possível(is) duplicata(s) marcada(s), não removida(s).</span>
          ) : null}
          {resultado.cobertura ? (
            <span>
              Telefone {resultado.cobertura.telefone}% · Site {resultado.cobertura.website}% · Coordenadas{' '}
              {resultado.cobertura.coordenadas}%
            </span>
          ) : null}
          {verificandoCrm ? (
            <span className="flex items-center gap-1">
              <Loader2 size={11} className="animate-spin" /> Verificando no CRM...
            </span>
          ) : crmMatches.size > 0 ? (
            <span>{crmMatches.size} já no CRM.</span>
          ) : null}
        </div>
      ) : null}

      {estado === 'sucesso' && resultado ? (
        <FiltrosOportunidade
          filtroCrm={filtroCrm}
          onFiltroCrm={setFiltroCrm}
          filtrosCrm={FILTROS_CRM}
          filtroOportunidade={filtroOportunidade}
          onFiltroOportunidade={setFiltroOportunidade}
          ordenacao={ordenacao}
          onOrdenacao={setOrdenacao}
        />
      ) : null}

      {estado !== 'sucesso' ? (
        <EstadoBusca
          estado={estado}
          detalhe={
            estado === 'sem_resultado'
              ? 'A fonte de descoberta foi consultada normalmente, mas não encontrou empresas para esta combinação de segmento e localização.'
              : estado === 'sem_cobertura'
                ? 'Tente uma localização mais específica (ex.: "cidade - UF") ou confira a grafia — a fonte não reconheceu esse lugar ou não possui dados mapeados ali.'
                : estado === 'indisponivel'
                  ? 'A fonte de descoberta (OpenStreetMap) pode estar temporariamente fora do ar ou demorando demais para responder. Tente novamente em alguns instantes.'
                  : undefined
          }
        />
      ) : (
        <>
          {/* Mobile: alternância entre lista e mapa */}
          <div className="flex gap-2 sm:hidden">
            {['lista', 'mapa'].map((aba) => (
              <button
                key={aba}
                onClick={() => setAbaMobile(aba)}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold capitalize ${
                  abaMobile === aba
                    ? 'bg-(--color-primary) text-white'
                    : 'border border-(--color-line) text-(--color-ink-secondary)'
                }`}
              >
                {aba}
              </button>
            ))}
          </div>

          <div className="grid h-[34rem] grid-cols-1 gap-4 sm:h-[38rem] sm:grid-cols-5">
            <div className={`${abaMobile === 'mapa' ? 'hidden' : ''} h-full space-y-3 overflow-y-auto sm:col-span-2 sm:block sm:pr-1`}>
              {leadsFiltrados.map((lead) => (
                <CardLead
                  key={lead.id}
                  lead={lead}
                  analise={lead.analise}
                  selecionado={lead.id === selecionadoId}
                  candidato={candidatos.has(lead.id)}
                  noCrm={crmMatches.has(lead.id)}
                  crmLeadId={crmMatches.get(lead.id)}
                  enviandoCrm={enviandoCrmId === lead.id}
                  onClick={() => setSelecionadoId(lead.id)}
                  onVerDetalhes={() => setLeadDetalhe(lead)}
                  onVerAnalise={() => setLeadAnalise(lead)}
                  onAdicionarAoCrm={adicionarAoCrm}
                />
              ))}
              {leadsFiltrados.length === 0 ? (
                <p className="rounded-xl border border-dashed border-(--color-line) px-3 py-6 text-center text-xs text-(--color-ink-secondary)">
                  Nenhum resultado neste filtro.
                </p>
              ) : null}
            </div>
            <div className={`${abaMobile === 'lista' ? 'hidden' : ''} h-full overflow-hidden rounded-2xl border border-(--color-line) sm:col-span-3 sm:block`}>
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-(--color-ink-secondary)">
                    <Loader2 size={22} className="animate-spin" />
                  </div>
                }
              >
                {/* Mapa SEMPRE reflete a mesma lista filtrada/ordenada da coluna ao
                lado — nunca a lista completa não filtrada (consistência
                lista/mapa pedida no planejamento). */}
                <MapaResultados leads={leadsFiltrados} selecionadoId={selecionadoId} onSelecionar={setSelecionadoId} />
              </Suspense>
            </div>
          </div>
        </>
      )}

      {candidatos.size > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-(--color-line) bg-(--color-canvas) px-3 py-2 text-xs text-(--color-ink-secondary)">
          <Users size={14} />
          {candidatos.size} candidato(s) selecionado(s) nesta sessão — use "Adicionar ao CRM" em cada card para persistir.
        </div>
      ) : null}

      {erroCrm ? (
        <div className="flex items-center gap-2 rounded-xl border border-(--color-danger)/30 bg-(--color-status-problema-bg) px-3 py-2 text-xs text-(--color-ink)">
          <AlertTriangle size={14} className="shrink-0" />
          {erroCrm}
        </div>
      ) : null}

      {confirmacaoCrm ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-(--color-green-light) bg-(--color-green-light)/15 px-3 py-2 text-xs text-(--color-ink)">
          <CheckCircle2 size={14} className="shrink-0 text-(--color-green)" />
          Lead adicionado ao CRM.
          <Link to={`/dashboard/crm?lead=${confirmacaoCrm.leadCriadoId}`} className="font-semibold text-(--color-primary) hover:underline">
            Abrir no CRM
          </Link>
          <button type="button" onClick={() => setConfirmacaoCrm(null)} className="ml-auto text-(--color-ink-secondary) hover:text-(--color-ink)">
            Fechar
          </button>
        </div>
      ) : null}

      <DrawerDetalhesLead
        lead={leadDetalhe}
        candidato={leadDetalhe ? candidatos.has(leadDetalhe.id) : false}
        noCrm={leadDetalhe ? crmMatches.has(leadDetalhe.id) : false}
        crmLeadId={leadDetalhe ? crmMatches.get(leadDetalhe.id) : null}
        enviandoCrm={leadDetalhe ? enviandoCrmId === leadDetalhe.id : false}
        onFechar={() => setLeadDetalhe(null)}
        onSelecionarCandidato={() => leadDetalhe && alternarCandidato(leadDetalhe.id)}
        onAdicionarAoCrm={adicionarAoCrm}
      />

      <DrawerAnaliseLead
        lead={leadAnaliseAtual}
        analise={leadAnaliseAtual?.analise}
        noCrm={leadAnaliseAtual ? crmMatches.has(leadAnaliseAtual.id) : false}
        crmLeadId={leadAnaliseAtual ? crmMatches.get(leadAnaliseAtual.id) : null}
        salvando={salvandoPresenca}
        onFechar={() => setLeadAnalise(null)}
        onSalvarPresencaManual={(patch) => leadAnaliseAtual && salvarPresencaManual(leadAnaliseAtual, patch)}
      />

      <ModalDuplicataCrm
        info={duplicataInfo}
        onCancelar={() => setDuplicataInfo(null)}
        onAbrirExistente={() => {
          const existenteId = duplicataInfo.leadExistente.id
          setCrmMatches((atual) => new Map(atual).set(duplicataInfo.lead.id, existenteId))
          setDuplicataInfo(null)
          navigate(`/dashboard/crm?lead=${existenteId}`)
        }}
        onAdicionarMesmoAssim={() => {
          const lead = duplicataInfo.lead
          setDuplicataInfo(null)
          adicionarAoCrm(lead, { forcar: true })
        }}
      />
    </div>
  )
}
