// Radar de Prospecção — Fase 2B (MVP). Arquitetura completa:
//
//   Prospeccao.jsx (esta tela)
//        ↓ fetch('/api/radar-buscar')
//   Radar Service/API (api/radar-buscar.js)
//        ↓
//   DiscoveryService → DiscoveryProvider → GoogleMapsScraperProvider
//        ↓                                   (MODO LAB — ver o arquivo)
//   Normalizer → Deduplicator → resultado normalizado
//
// Esta tela NÃO conhece o provider nem o formato bruto do scraper — só o
// contrato JSON devolvido pelo endpoint. Troca de provider (ex.: um futuro
// GooglePlacesProvider) não exige tocar neste arquivo.
//
// "Resultado de busca" vs. "candidato selecionado" (item 12 do
// planejamento): resultados ficam só em memória/estado do componente, MAS
// a Fase 2F acrescenta um CACHE da última busca no localStorage (ver
// CHAVE_CACHE_BUSCA abaixo) — só para não perder a última pesquisa ao
// recarregar a página, nunca como substituto de uma busca ao vivo.
// "Candidatos selecionados" continuam persistindo no localStorage do
// navegador (por sessão de quem está usando, não sincronizado entre
// pessoas/dispositivos e NUNCA gravado no Supabase de leads/clientes nesta
// fase — ver item 15).

import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, Loader2, CheckCircle2, History, RotateCcw, Sparkles } from 'lucide-react'
import BarraBusca from '../components/radar/BarraBusca'
import EstadoBusca from '../components/radar/EstadoBusca'
import CardLead from '../components/radar/CardLead'
import DrawerDetalhesLead from '../components/radar/DrawerDetalhesLead'
import ModalDuplicataCrm from '../components/radar/ModalDuplicataCrm'
import { criarLeadDoRadar, verificarDuplicatasEmLote } from '../lib/crm/LeadsService'

// maplibre-gl é uma lib pesada (~190kB gzip) — carregada só quando a tela
// de Prospecção de fato renderiza o mapa, via code-splitting, em vez de
// entrar no bundle principal de todas as páginas do Control.
const MapaResultados = lazy(() => import('../components/radar/MapaResultados'))

const CHAVE_CANDIDATOS = 'moraes_dev_control_radar_candidatos_v1'

// ----------------------------------------------------------------------------
// Cache da última pesquisa (Fase 2F, item "continuidade da prospecção") —
// SÓ isso: a última busca, nunca um histórico. Formato documentado:
//   { version: 1, savedAt: <ISO>, query: {segmento,localizacao,quantidade},
//     results: <mesmo objeto devolvido por /api/radar-buscar> }
// TTL sugerido de 24h (item do planejamento) — passado isso, o cache ainda
// é lido mas a UI deixa claro que pode estar desatualizado via o timestamp
// exibido; NUNCA são salvos aqui tokens/segredos/instâncias de
// MapLibre/nós de DOM/funções/erros técnicos — só os mesmos dados simples
// (texto/número) que já aparecem na tela.
// ----------------------------------------------------------------------------
const CHAVE_CACHE_BUSCA = 'moraes_dev_control_radar_ultima_busca_v1'
const VERSAO_CACHE_BUSCA = 1
const TTL_CACHE_BUSCA_MS = 24 * 60 * 60 * 1000

function carregarCacheBusca() {
  try {
    const bruto = localStorage.getItem(CHAVE_CACHE_BUSCA)
    if (!bruto) return null
    const cache = JSON.parse(bruto)
    // Validação defensiva — um valor corrompido, de uma versão antiga, ou
    // faltando algum campo essencial é tratado como "sem cache", nunca
    // deixado quebrar a tela (item explícito do planejamento).
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
    // Mesmo passado o TTL sugerido, devolve o cache (só marcado como
    // "antigo" — ver `expirado` abaixo) em vez de descartar silenciosamente
    // o último resultado: quem decide se quer confiar nele é a pessoa, a
    // UI só avisa com destaque quando passou de 24h.
    return { ...cache, expirado: idadeMs > TTL_CACHE_BUSCA_MS }
  } catch {
    try {
      localStorage.removeItem(CHAVE_CACHE_BUSCA)
    } catch {
      /* localStorage indisponível — nada a fazer, segue sem cache */
    }
    return null
  }
}

function salvarCacheBusca(query, results) {
  try {
    localStorage.setItem(
      CHAVE_CACHE_BUSCA,
      JSON.stringify({ version: VERSAO_CACHE_BUSCA, savedAt: new Date().toISOString(), query, results })
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
  const [form, setForm] = useState({ segmento: '', localizacao: '', quantidade: 20 })
  const [estado, setEstado] = useState('inicial') // inicial|buscando|normalizando|sucesso|sem_resultado|erro|bloqueio
  const [resultado, setResultado] = useState(null)
  const [restauradoDoCache, setRestauradoDoCache] = useState(null) // { savedAt, expirado } | null
  const [abaMobile, setAbaMobile] = useState('lista') // lista|mapa
  const [selecionadoId, setSelecionadoId] = useState(null)
  const [leadDetalhe, setLeadDetalhe] = useState(null)
  const [candidatos, setCandidatos] = useState(() => carregarCandidatos())
  const [filtroCrm, setFiltroCrm] = useState('todos')
  // Fase 2C — integração Radar → CRM (item 14 do planejamento). Nada aqui
  // é persistido em localStorage: `leadsNoCrm` é só feedback visual da
  // sessão atual (já existe na tabela leads no Supabase; um refresh da
  // página volta a consultar e, se tentar adicionar de novo, a
  // deduplicação do LeadsService pega pelo mesmo sinal "origem").
  //
  // Fase 2F — unifica com a reconciliação real contra o CRM: o Map abaixo
  // guarda `radarLeadId -> idDoLeadNoSupabase` tanto para leads enviados
  // NESTA sessão quanto para os encontrados pela checagem em lote ao
  // carregar/restaurar resultados. O Supabase é sempre a fonte da verdade —
  // a checagem roda de novo a cada busca/restauração, nunca confia só no
  // cache.
  const [crmMatches, setCrmMatches] = useState(() => new Map())
  const [verificandoCrm, setVerificandoCrm] = useState(false)
  const [enviandoCrmId, setEnviandoCrmId] = useState(null)
  const [duplicataInfo, setDuplicataInfo] = useState(null) // { lead, leadExistente, sinal }
  const [confirmacaoCrm, setConfirmacaoCrm] = useState(null) // { leadId, leadCriadoId }
  const [erroCrm, setErroCrm] = useState(null)

  useEffect(() => {
    salvarCandidatos(candidatos)
  }, [candidatos])

  // Restaura a última pesquisa do cache SÓ na primeira renderização, e só
  // se não há nada em andamento — nunca sobrescreve uma busca que a pessoa
  // já tenha disparado nesta visita.
  useEffect(() => {
    const cache = carregarCacheBusca()
    if (!cache) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura o estado da última pesquisa a partir do localStorage, só uma vez, ao montar a tela
    setForm(cache.query)
    setResultado(cache.results)
    setEstado(cache.results.resultados?.length ? 'sucesso' : 'sem_resultado')
    setRestauradoDoCache({ savedAt: cache.savedAt, expirado: cache.expirado })
  }, [])

  // "Já no CRM" (Fase 2F) — reconciliação contra o Supabase real sempre que
  // a lista de resultados muda (busca nova OU restaurada do cache). Nunca
  // lê do cache para decidir isso — só da tabela `leads` de verdade.
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
        // Falha na checagem "já no CRM" é só perda de uma informação
        // complementar — nunca deve impedir a visualização dos resultados
        // do Radar (regra de resiliência também aplicada no Dashboard).
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

  async function executarBusca(parametros) {
    setEstado('buscando')
    setResultado(null)
    setRestauradoDoCache(null)
    setSelecionadoId(null)

    try {
      const resp = await fetch('/api/radar-buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parametros),
      })
      const dados = await resp.json()

      // Transição rápida de UI — a normalização real já ocorreu no
      // servidor antes da resposta chegar; este estado só comunica que o
      // resultado está sendo formatado para exibição.
      setEstado('normalizando')
      await new Promise((r) => setTimeout(r, 200))

      if (!resp.ok || dados.status === 'erro') {
        setEstado('erro')
        return
      }
      if (dados.status === 'bloqueio') {
        setEstado('bloqueio')
        return
      }
      if (dados.status === 'sem_resultado' || !dados.resultados?.length) {
        setEstado('sem_resultado')
        limparCacheBusca()
        return
      }

      setResultado(dados)
      setEstado('sucesso')
      salvarCacheBusca(parametros, dados)
    } catch {
      setEstado('erro')
    }
  }

  function buscar() {
    return executarBusca(form)
  }

  // "[Nova pesquisa]" (item do planejamento) — limpa resultados, seleção
  // atual na tela e o cache; reseta o formulário. NUNCA apaga os
  // `candidatos` persistidos (seleção que atravessa buscas/sessões, já
  // documentada desde a Fase 2B) nem qualquer dado do CRM.
  function novaPesquisa() {
    setForm({ segmento: '', localizacao: '', quantidade: 20 })
    setResultado(null)
    setEstado('inicial')
    setSelecionadoId(null)
    setRestauradoDoCache(null)
    setCrmMatches(new Map())
    setFiltroCrm('todos')
    limparCacheBusca()
  }

  function alternarCandidato(leadId) {
    setCandidatos((anterior) => {
      const novo = new Set(anterior)
      if (novo.has(leadId)) novo.delete(leadId)
      else novo.add(leadId)
      return novo
    })
  }

  const todosLeads = resultado?.resultados || []
  const leads = todosLeads.filter((lead) => {
    if (filtroCrm === 'no_crm') return crmMatches.has(lead.id)
    if (filtroCrm === 'nao_enviados') return !crmMatches.has(lead.id)
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-(--color-ink)">Radar de Prospecção</h1>
          <p className="mt-0.5 text-sm text-(--color-ink-secondary)">
            Busca experimental de empresas por segmento e localização, com visualização em lista e mapa.
          </p>
        </div>
        {estado === 'sucesso' || estado === 'sem_resultado' ? (
          <button
            type="button"
            onClick={novaPesquisa}
            className="flex items-center gap-1.5 rounded-xl border border-(--color-line) bg-(--color-surface) px-3 py-1.5 text-xs font-semibold text-(--color-ink-secondary) hover:text-(--color-primary)"
          >
            <RotateCcw size={13} /> Nova pesquisa
          </button>
        ) : null}
      </div>

      <BarraBusca
        segmento={form.segmento}
        localizacao={form.localizacao}
        quantidade={form.quantidade}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onBuscar={buscar}
        buscando={estado === 'buscando' || estado === 'normalizando'}
      />

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
          <button type="button" onClick={buscar} className="ml-auto flex items-center gap-1 font-semibold text-(--color-primary) hover:underline">
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
          {resultado.gruposDuplicados?.length ? (
            <span>
              {resultado.gruposDuplicados.length} possível(is) duplicata(s) marcada(s), não removida(s).
            </span>
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

          <div className="ml-auto flex rounded-lg border border-(--color-line) bg-(--color-surface) p-0.5">
            {FILTROS_CRM.map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltroCrm(f.valor)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                  filtroCrm === f.valor ? 'bg-(--color-primary) text-white' : 'text-(--color-ink-secondary)'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {estado !== 'sucesso' ? (
        <EstadoBusca
          estado={estado}
          detalhe={
            estado === 'sem_resultado'
              ? 'Neste MVP (modo laboratório), apenas combinações já testadas na Fase 2A/2A.1 têm dados reais — tente "Barbearias"/"Cotia, SP", "Dentistas"/"Cotia, SP" ou "Restaurantes"/"Barueri, SP".'
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
              {leads.map((lead) => (
                <CardLead
                  key={lead.id}
                  lead={lead}
                  selecionado={lead.id === selecionadoId}
                  candidato={candidatos.has(lead.id)}
                  noCrm={crmMatches.has(lead.id)}
                  crmLeadId={crmMatches.get(lead.id)}
                  enviandoCrm={enviandoCrmId === lead.id}
                  onClick={() => setSelecionadoId(lead.id)}
                  onVerDetalhes={() => setLeadDetalhe(lead)}
                  onAdicionarAoCrm={adicionarAoCrm}
                />
              ))}
              {leads.length === 0 ? (
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
                <MapaResultados leads={leads} selecionadoId={selecionadoId} onSelecionar={setSelecionadoId} />
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

      <ModalDuplicataCrm
        info={duplicataInfo}
        onCancelar={() => setDuplicataInfo(null)}
        onAbrirExistente={() => {
          const existenteId = duplicataInfo.leadExistente.id
          // Marca "já no CRM" mesmo sem criar um novo registro — o
          // candidato do Radar já corresponde a um lead real existente.
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
