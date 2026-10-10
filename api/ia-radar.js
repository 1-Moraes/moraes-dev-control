// Vercel Function — "IA Comercial" (Fase 3B). Mesmo padrão arquitetural de
// api/radar-buscar.js (Fase 2B/3A): esta é a ÚNICA porta de entrada da IA,
// o frontend (AIService.js) só conhece este endpoint HTTP, nunca importa
// AIOrchestrator.js nem os providers diretamente.
//
//   AIService.js (navegador)
//        ↓ fetch('/api/ia-radar') com Authorization: Bearer <access_token>
//   este arquivo
//        ↓ autenticação + autorização (RLS, nunca service_role) + rate limit
//   AIOrchestrator.executar()  →  AnthropicProvider ou OpenAIProvider (fallback)
//        ↓
//   validação estrutural da resposta (schemaAnaliseComercial.js)
//        ↓
//   log em ai_logs (sempre, sucesso ou falha) + resposta ao cliente
//
// SEGURANÇA (itens 28/29/30 do planejamento):
//   - toda chamada exige um token de sessão Supabase válido de um membro
//     provisionado (tem pelo menos um papel em user_roles) — ver
//     autenticacaoServidor.js. Nenhuma chamada anônima é aceita.
//   - os dados da empresa (vindos do Radar/site) são tratados como dado
//     NÃO CONFIÁVEL dentro do prompt (ver promptComercial.js) — nunca como
//     instrução. Este endpoint nunca dá à IA acesso a banco, shell,
//     secrets ou envio de mensagens: ela só devolve texto estruturado.
//   - nenhuma API key (Anthropic/OpenAI/Supabase) chega ao cliente. Erros
//     devolvidos ao navegador nunca incluem stack trace nem texto de erro
//     cru do provider — só uma mensagem genérica e um `estado` classificado.

import { executar as executarIA, statusProviders } from '../src/lib/ai/AIOrchestrator.js'
import { autenticarEAutorizar, extrairBearerToken, verificarLimiteUso } from '../src/lib/ai/autenticacaoServidor.js'
import { obterLimites } from '../src/lib/ai/limites.js'
import { montarMensagemUsuario, PROMPT_COMERCIAL_SISTEMA, PROMPT_COMERCIAL_VERSAO } from '../src/lib/ai/prompts/promptComercial.js'
import { validarAnaliseComercial, validarAbordagem } from '../src/lib/ai/schemaAnaliseComercial.js'
import { sanitizarDadosEmpresa } from '../src/lib/ai/sanitizarDadosEmpresa.js'

const TAREFAS_VALIDAS = ['analisar_oportunidade', 'gerar_abordagem']
const INSTRUCOES_ADICIONAIS_MAX_LEN = 500

async function registrarLog(clienteSupabase, linha) {
  // Log técnico nunca impede a resposta ao usuário — se a escrita falhar
  // (ex.: RLS, rede), a análise já concluída (ou o erro já classificado)
  // ainda é devolvida; só o log fica faltando, e isso vai pro console da
  // função (nunca silenciosamente ignorado).
  const { error } = await clienteSupabase.from('ai_logs').insert(linha)
  if (error) console.error('ia.log.falha_ao_registrar', error)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'erro', estado: 'metodo_invalido', mensagemErro: 'Método não permitido.' })
    return
  }

  const timestamp = new Date().toISOString()
  const token = extrairBearerToken(req.headers)
  const autenticacao = await autenticarEAutorizar(token)

  if (!autenticacao.autorizado) {
    const mapaEstadoHttp = { nao_configurado: 503, token_ausente: 401, token_invalido: 401, sem_permissao: 403 }
    const mapaMensagem = {
      nao_configurado: 'IA ainda não configurada neste ambiente. Configure SUPABASE_URL (server-side) para habilitar esta rota.',
      token_ausente: 'Sessão não encontrada. Faça login novamente.',
      token_invalido: 'Sessão inválida ou expirada. Faça login novamente.',
      sem_permissao: 'Seu usuário não tem permissão para executar análises de IA.',
    }
    res.status(mapaEstadoHttp[autenticacao.motivo] || 401).json({ status: 'erro', estado: autenticacao.motivo, mensagemErro: mapaMensagem[autenticacao.motivo] })
    return
  }

  const { userId, clienteSupabase } = autenticacao
  const { tarefa, leadId, empresaCandidata, analise, instrucoesAdicionais } = req.body || {}

  // Validação de payload (item 30: "validação de payload, limites de
  // tamanho") — nunca confia em nada vindo do cliente sem checar forma e
  // tamanho antes de gastar uma chamada de IA.
  if (!TAREFAS_VALIDAS.includes(tarefa)) {
    res.status(400).json({ status: 'erro', estado: 'payload_invalido', mensagemErro: 'Tarefa inválida.' })
    return
  }
  if (!empresaCandidata || typeof empresaCandidata !== 'object' || Array.isArray(empresaCandidata)) {
    res.status(400).json({ status: 'erro', estado: 'payload_invalido', mensagemErro: 'Dados da empresa ausentes ou inválidos.' })
    return
  }
  if (leadId != null && typeof leadId !== 'string') {
    res.status(400).json({ status: 'erro', estado: 'payload_invalido', mensagemErro: 'leadId inválido.' })
    return
  }
  if (instrucoesAdicionais != null && (typeof instrucoesAdicionais !== 'string' || instrucoesAdicionais.length > INSTRUCOES_ADICIONAIS_MAX_LEN)) {
    res.status(400).json({ status: 'erro', estado: 'payload_invalido', mensagemErro: 'Instruções adicionais inválidas ou longas demais.' })
    return
  }

  const limites = obterLimites()
  const tamanhoPayload = JSON.stringify(req.body || {}).length
  if (tamanhoPayload > limites.tamanhoMaximoPayloadBytes) {
    res.status(413).json({ status: 'erro', estado: 'payload_muito_grande', mensagemErro: 'Dados enviados excedem o limite permitido.' })
    return
  }

  // Rate limiting (item 9/30) — antes de verificar providers/gastar
  // qualquer chamada de IA.
  const { dentroDoLimite, usoAtual } = await verificarLimiteUso(clienteSupabase, userId, limites.limiteRequisicoesPorUsuarioPorHora)
  if (!dentroDoLimite) {
    res.status(429).json({ status: 'erro', estado: 'limite_utilizacao', mensagemErro: `Limite de ${limites.limiteRequisicoesPorUsuarioPorHora} análises de IA por hora atingido.` })
    return
  }

  // "IA não configurada" é um estado de primeira classe (item 32), nunca
  // um 500 genérico — distinto de qualquer falha de provider em tempo de
  // execução.
  const status = statusProviders()
  if (!status.algumConfigurado) {
    res.status(200).json({
      status: 'nao_configurada',
      estado: 'ia_nao_configurada',
      mensagemErro: 'IA ainda não configurada. Configure uma chave de API (ANTHROPIC_API_KEY+ANTHROPIC_MODEL ou OPENAI_API_KEY+OPENAI_MODEL) para habilitar análises.',
      timestamp,
    })
    return
  }

  const dadosSanitizados = sanitizarDadosEmpresa(empresaCandidata, analise)
  const mensagemUsuario = montarMensagemUsuario(dadosSanitizados, tarefa, instrucoesAdicionais)
  const entidadeTipo = leadId ? 'lead' : null

  let resultadoIA
  try {
    resultadoIA = await executarIA({ sistemaPrompt: PROMPT_COMERCIAL_SISTEMA, mensagemUsuario })
  } catch (erro) {
    await registrarLog(clienteSupabase, {
      provider: erro.tentativas?.[erro.tentativas.length - 1]?.provider || 'desconhecido',
      model: 'desconhecido',
      feature: tarefa,
      sucesso: false,
      erro: `${erro.tipo || 'desconhecido'}: ${String(erro.message || '').slice(0, 300)}`,
      duracao_ms: null,
      usuario_id: userId,
      entidade_tipo: entidadeTipo,
      entidade_id: leadId || null,
    })

    const mapaEstado = {
      credencial_ausente: 'ia_nao_configurada',
      credencial_invalida: 'provedor_indisponivel',
      limite: 'limite_provedor',
      indisponivel: 'provedor_indisponivel',
      resposta_invalida: 'resposta_invalida',
      desconhecido: 'erro',
    }
    const estado = mapaEstado[erro.tipo] || 'erro'
    // Mensagem específica para `limite_provedor` (item 10 do ajuste
    // "custo zero"): quando a cota GRATUITA de todos os providers
    // configurados se esgota, isso nunca é um erro genérico — é um aviso
    // claro de que a análise de IA parou temporariamente, e nunca afeta
    // Radar/CRM (que não dependem da IA para nada).
    const mapaMensagem = {
      limite_provedor: 'A cota gratuita de IA foi esgotada por agora (todos os provedores configurados sinalizaram limite). Novas análises de IA ficam indisponíveis até a cota renovar — o Radar e o CRM continuam funcionando normalmente.',
    }
    res.status(estado === 'ia_nao_configurada' ? 200 : 502).json({
      status: estado === 'ia_nao_configurada' ? 'nao_configurada' : 'erro',
      estado,
      mensagemErro: mapaMensagem[estado] || 'Não foi possível concluir a análise de IA agora. Tente novamente em alguns instantes.',
      timestamp,
    })
    return
  }

  const validador = tarefa === 'gerar_abordagem' ? validarAbordagem : validarAnaliseComercial
  const validacao = validador(resultadoIA.texto)

  await registrarLog(clienteSupabase, {
    provider: resultadoIA.provider,
    model: resultadoIA.model,
    feature: tarefa,
    tokens_entrada: resultadoIA.tokensEntrada,
    tokens_saida: resultadoIA.tokensSaida,
    duracao_ms: resultadoIA.duracaoMs,
    sucesso: validacao.valido,
    erro: validacao.valido ? null : `resposta_invalida: ${validacao.erros.join('; ')}`.slice(0, 300),
    usuario_id: userId,
    entidade_tipo: entidadeTipo,
    entidade_id: leadId || null,
  })

  if (!validacao.valido) {
    res.status(502).json({
      status: 'erro',
      estado: 'resposta_invalida',
      mensagemErro: 'A IA respondeu em um formato inesperado. Tente novamente.',
      timestamp,
    })
    return
  }

  res.status(200).json({
    status: 'ok',
    estado: 'concluida',
    dados: validacao.dados,
    provider: resultadoIA.provider,
    model: resultadoIA.model,
    promptVersao: PROMPT_COMERCIAL_VERSAO,
    usoNaUltimaHora: usoAtual + 1,
    limitePorHora: limites.limiteRequisicoesPorUsuarioPorHora,
    timestamp,
  })
}
