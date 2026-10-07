// Vercel Function — "Radar Service/API" do planejamento da Fase 2B.
//
//   PROSPECÇÃO UI  →  Radar Service/API (este arquivo)  →  DiscoveryService
//        →  DiscoveryProvider  →  GoogleMapsScraperProvider
//        →  Normalizer  →  Deduplicator  →  resultado normalizado
//
// O frontend (src/pages/Prospeccao.jsx) só conhece este endpoint HTTP — não
// importa nada de src/lib/radar/ diretamente, e nunca vê o nome do provider
// real por trás. Isso é o que permite trocar/adicionar provider (ex.: um
// futuro GooglePlacesProvider) sem tocar no React.
//
// Roda server-side (runtime Node da Vercel): é aqui, e só aqui, que
// qualquer chamada futura a um provider real com credenciais aconteceria —
// nunca no bundle do Vite. Nesta fase (MODO LAB), nem isso é necessário:
// o provider lê fixtures locais (ver GoogleMapsScraperProvider.js).
//
// SEGURANÇA: nenhuma credencial do Moraes.Dev Control, Supabase, GitHub ou
// Vercel é lida, usada ou logada aqui. O log de busca (abaixo) só registra
// metadados da consulta, nunca dados sensíveis.

import { executarBusca } from '../src/lib/radar/DiscoveryService.js'

const SEGMENTOS_VALIDOS_MAX_LEN = 60
const LOCALIZACAO_MAX_LEN = 80
const QUANTIDADES_PERMITIDAS = [10, 20, 50]

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'erro', mensagemErro: 'Método não permitido.' })
    return
  }

  const { segmento, localizacao, quantidade } = req.body || {}

  // Validação conservadora (item 6 do planejamento: "não permitir buscas
  // absurdamente grandes nesta versão" + limites básicos de entrada).
  if (
    typeof segmento !== 'string' ||
    !segmento.trim() ||
    segmento.length > SEGMENTOS_VALIDOS_MAX_LEN ||
    typeof localizacao !== 'string' ||
    !localizacao.trim() ||
    localizacao.length > LOCALIZACAO_MAX_LEN ||
    !QUANTIDADES_PERMITIDAS.includes(Number(quantidade))
  ) {
    res.status(400).json({ status: 'erro', mensagemErro: 'Parâmetros de busca inválidos.' })
    return
  }

  const timestamp = new Date().toISOString()

  try {
    const resultado = await executarBusca({
      segmento: segmento.trim(),
      localizacao: localizacao.trim(),
      quantidade: Number(quantidade),
    })

    // Log técnico (item 14 do planejamento) — só no console da Vercel
    // Function nesta fase, sem persistência própria ainda (ver relatório
    // final, seção "estratégia de resultados temporários"). Nenhum secret,
    // nenhum dado pessoal de lead — só metadados da busca.
    console.log(
      JSON.stringify({
        evento: 'radar.busca',
        timestamp,
        provider: resultado.provider,
        segmento: segmento.trim(),
        localizacao: localizacao.trim(),
        quantidadeSolicitada: resultado.quantidadeSolicitada,
        quantidadeRetornada: resultado.quantidadeRetornada,
        quantidadeAposNormalizacao: resultado.quantidadeAposNormalizacao,
        duplicatasPossiveis: resultado.gruposDuplicados?.length || 0,
        duracaoMs: resultado.duracaoMs,
        status: resultado.status,
        erro: resultado.mensagemErro || null,
      })
    )

    res.status(200).json({ ...resultado, timestamp })
  } catch (erro) {
    // erro.stack fica só no log server-side (nunca no texto livre devolvido
    // ao cliente) — exatamente para depuração, sem expor caminhos internos.
    console.error('radar.busca.erro_inesperado', { timestamp, segmento, localizacao }, erro)
    res.status(500).json({
      status: 'erro',
      mensagemErro: 'Não foi possível concluir a busca.',
      timestamp,
    })
  }
}
