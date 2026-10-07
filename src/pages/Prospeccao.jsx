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
// planejamento): resultados ficam só em memória/estado do componente
// (perdidos ao recarregar — ver nota no relatório final). "Candidatos
// selecionados" persistem no localStorage do navegador (por sessão de
// quem está usando, não sincronizado entre pessoas/dispositivos e NUNCA
// gravado no Supabase de leads/clientes nesta fase — ver item 15).

import { lazy, Suspense, useEffect, useState } from 'react'
import { Users, Loader2 } from 'lucide-react'
import BarraBusca from '../components/radar/BarraBusca'
import EstadoBusca from '../components/radar/EstadoBusca'
import CardLead from '../components/radar/CardLead'
import DrawerDetalhesLead from '../components/radar/DrawerDetalhesLead'

// maplibre-gl é uma lib pesada (~190kB gzip) — carregada só quando a tela
// de Prospecção de fato renderiza o mapa, via code-splitting, em vez de
// entrar no bundle principal de todas as páginas do Control.
const MapaResultados = lazy(() => import('../components/radar/MapaResultados'))

const CHAVE_CANDIDATOS = 'moraes_dev_control_radar_candidatos_v1'

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

export default function Prospeccao() {
  const [form, setForm] = useState({ segmento: '', localizacao: '', quantidade: 20 })
  const [estado, setEstado] = useState('inicial') // inicial|buscando|normalizando|sucesso|sem_resultado|erro|bloqueio
  const [resultado, setResultado] = useState(null)
  const [abaMobile, setAbaMobile] = useState('lista') // lista|mapa
  const [selecionadoId, setSelecionadoId] = useState(null)
  const [leadDetalhe, setLeadDetalhe] = useState(null)
  const [candidatos, setCandidatos] = useState(() => carregarCandidatos())

  useEffect(() => {
    salvarCandidatos(candidatos)
  }, [candidatos])

  async function buscar() {
    setEstado('buscando')
    setResultado(null)
    setSelecionadoId(null)

    try {
      const resp = await fetch('/api/radar-buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
        return
      }

      setResultado(dados)
      setEstado('sucesso')
    } catch {
      setEstado('erro')
    }
  }

  function alternarCandidato(leadId) {
    setCandidatos((anterior) => {
      const novo = new Set(anterior)
      if (novo.has(leadId)) novo.delete(leadId)
      else novo.add(leadId)
      return novo
    })
  }

  const leads = resultado?.resultados || []

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-(--color-ink)">Radar de Prospecção</h1>
        <p className="mt-0.5 text-sm text-(--color-ink-secondary)">
          Busca experimental de empresas por segmento e localização, com visualização em lista e mapa.
        </p>
      </div>

      <BarraBusca
        segmento={form.segmento}
        localizacao={form.localizacao}
        quantidade={form.quantidade}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onBuscar={buscar}
        buscando={estado === 'buscando' || estado === 'normalizando'}
      />

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
                  onClick={() => setSelecionadoId(lead.id)}
                  onVerDetalhes={() => setLeadDetalhe(lead)}
                />
              ))}
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
          {candidatos.size} candidato(s) selecionado(s) nesta sessão — ainda não enviados ao CRM.
        </div>
      ) : null}

      <DrawerDetalhesLead
        lead={leadDetalhe}
        candidato={leadDetalhe ? candidatos.has(leadDetalhe.id) : false}
        onFechar={() => setLeadDetalhe(null)}
        onSelecionarCandidato={() => leadDetalhe && alternarCandidato(leadDetalhe.id)}
      />
    </div>
  )
}
