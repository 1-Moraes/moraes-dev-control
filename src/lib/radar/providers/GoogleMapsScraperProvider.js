// GoogleMapsScraperProvider — implementação concreta de DiscoveryProvider,
// MODO LAB (item 5 do planejamento da Fase 2B).
//
// POR QUE MODO LAB, NÃO PRODUÇÃO:
// O scraper real (gosom/google-maps-scraper) roda em Docker com Playwright,
// levando de 1 a poucos minutos por consulta. Isso NÃO pode rodar:
//   - dentro do frontend React (nunca é empacotado no bundle Vite);
//   - dentro de uma Vercel Function comum (sem suporte a Playwright/
//     processos de longa duração no plano usado por este projeto).
// Executar isso em produção exigiria infraestrutura própria (VPS, fila de
// jobs, ou serviço gerenciado) — uma decisão de CUSTO RECORRENTE que o
// item 22 do planejamento da Fase 2B explicitamente proíbe que eu tome
// sozinho. Por isso, nesta fase, o provider "real" lê os resultados dos
// TRÊS testes reais já executados na Fase 2A/2A.1 (barbearias-cotia.json,
// dentistas-cotia.json, restaurantes-barueri.json — mesmos arquivos do
// moraes-radar-lab, copiados para api/_radar-lab-fixtures/, fora do bundle
// do Vite), filtrando por segmento+localização.
//
// Isso é dado REAL (não fabricado), só que pré-coletado em vez de buscado
// ao vivo a cada clique — uma limitação explícita e documentada, não uma
// simulação disfarçada de produção. Ver relatório final da Fase 2B para a
// recomendação de infraestrutura quando/se a execução ao vivo for
// autorizada.
//
// Quando a Fase 2B.1 (execução ao vivo) for autorizada e a decisão de
// infraestrutura tomada, este arquivo passa a chamar um serviço HTTP
// externo (ex.: um worker com o Docker do laboratório, atrás de
// autenticação) em vez de ler fixtures locais — o contrato (buscar()) não
// muda, então DiscoveryService e o resto do pipeline não precisam mudar.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Caminho relativo a partir deste arquivo até api/_radar-lab-fixtures/
// (este arquivo fica em src/lib/radar/providers/, a Vercel Function em
// api/radar-buscar.js — ambos acabam no mesmo bundle de função serverless,
// então um caminho relativo simples resolve nos dois ambientes: dev local
// via `vercel dev` e produção).
const PASTA_FIXTURES = path.resolve(__dirname, '../../../../api/_radar-lab-fixtures')

// Catálogo do que foi REALMENTE testado na Fase 2A/2A.1 — ver
// moraes-radar-lab/docs/relatorio-fase-2a.md e relatorio-fase-2a1-validacao.md.
// Cada entrada: termos de segmento aceitos (minúsculo, sem acento) + termos
// de localização aceitos + arquivo de fixture correspondente.
const CATALOGO_TESTADO = [
  {
    arquivo: 'barbearias-cotia.json',
    segmentos: ['barbearia', 'barbearias', 'barber', 'barbeiro'],
    localizacoes: ['cotia'],
    queryOriginal: 'barbearia in Cotia, SP, Brazil',
  },
  {
    arquivo: 'dentistas-cotia.json',
    segmentos: ['dentista', 'dentistas', 'odontologia', 'odonto', 'clinica odontologica'],
    localizacoes: ['cotia'],
    queryOriginal: 'dentista in Cotia, SP, Brazil',
  },
  {
    arquivo: 'restaurantes-barueri.json',
    segmentos: ['restaurante', 'restaurantes'],
    localizacoes: ['barueri'],
    queryOriginal: 'restaurante in Barueri, SP, Brazil',
  },
]

function semAcento(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function encontrarFixture(segmento, localizacao) {
  const seg = semAcento(segmento)
  const loc = semAcento(localizacao)
  return CATALOGO_TESTADO.find(
    (item) =>
      item.segmentos.some((s) => seg.includes(s) || s.includes(seg)) &&
      item.localizacoes.some((l) => loc.includes(l))
  )
}

/**
 * @param {import('./DiscoveryProvider').ParametrosBusca} parametros
 * @returns {Promise<import('./DiscoveryProvider').ResultadoBrutoProvider>}
 */
export async function buscar({ segmento, localizacao, quantidade }) {
  const inicio = Date.now()
  const catalogo = encontrarFixture(segmento, localizacao)

  if (!catalogo) {
    return {
      registros: [],
      provider: 'google_maps_scraper_lab',
      status: 'sem_resultado',
      duracaoMs: Date.now() - inicio,
    }
  }

  try {
    const caminho = path.join(PASTA_FIXTURES, catalogo.arquivo)
    const texto = fs.readFileSync(caminho, 'utf-8').trim()
    // Mesmo parser tolerante do normalize.py: aceita array único ou JSON Lines.
    let registros
    try {
      const bruto = JSON.parse(texto)
      registros = Array.isArray(bruto) ? bruto : [bruto]
    } catch {
      registros = texto
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l))
    }

    const limite = Math.max(1, Math.min(50, Number(quantidade) || 20))
    return {
      registros: registros.slice(0, limite),
      provider: 'google_maps_scraper_lab',
      status: 'ok',
      duracaoMs: Date.now() - inicio,
      queryUsada: catalogo.queryOriginal,
    }
  } catch (erro) {
    return {
      registros: [],
      provider: 'google_maps_scraper_lab',
      status: 'erro',
      mensagemErro: 'Falha ao ler fixture do laboratório',
      duracaoMs: Date.now() - inicio,
      _erroTecnico: String(erro && erro.message),
    }
  }
}
