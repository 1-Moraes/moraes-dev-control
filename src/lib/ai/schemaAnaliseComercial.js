// Validação estrutural da saída da IA — Fase 3B, item 13 do planejamento:
// "não confiar que o JSON retornado pelo modelo será sempre válido".
// Função pura, sem I/O, chamada por AIOrchestrator.js depois de qualquer
// provider responder, ANTES de a resposta seguir para o frontend ou ser
// persistida. Nunca lança — devolve {valido, erros, dados} para quem chama
// decidir o que fazer (log + erro `resposta_invalida`, nunca um crash).

const CAMPOS_STRING_OBRIGATORIOS = ['resumo_comercial', 'oportunidade_principal']
const CAMPOS_ARRAY_STRING = ['evidencias_utilizadas', 'hipoteses', 'limitacoes']

function eString(v) {
  return typeof v === 'string'
}
function eArrayDeString(v) {
  return Array.isArray(v) && v.every((item) => typeof item === 'string')
}

/**
 * @param {unknown} textoResposta - texto bruto devolvido pelo provider (deve ser um JSON)
 * @returns {{valido: boolean, erros: string[], dados: Object|null}}
 */
export function validarAnaliseComercial(textoResposta) {
  const erros = []
  let obj

  try {
    obj = JSON.parse(textoResposta)
  } catch {
    return { valido: false, erros: ['Resposta não é um JSON válido.'], dados: null }
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valido: false, erros: ['Resposta não é um objeto JSON.'], dados: null }
  }

  for (const campo of CAMPOS_STRING_OBRIGATORIOS) {
    if (!eString(obj[campo]) || !obj[campo].trim()) erros.push(`Campo "${campo}" ausente ou vazio.`)
  }
  for (const campo of CAMPOS_ARRAY_STRING) {
    if (obj[campo] !== undefined && !eArrayDeString(obj[campo])) erros.push(`Campo "${campo}" deveria ser um array de strings.`)
  }

  if (obj.servico_recomendado !== undefined) {
    const sr = obj.servico_recomendado
    if (!sr || typeof sr !== 'object' || !eString(sr.tipo) || !eString(sr.justificativa)) {
      erros.push('Campo "servico_recomendado" deveria ter "tipo" e "justificativa" como strings.')
    }
  }

  if (obj.estrategia !== undefined) {
    const es = obj.estrategia
    if (
      !es ||
      typeof es !== 'object' ||
      !eString(es.objetivo_primeiro_contato) ||
      !eArrayDeString(es.pontos_para_conversa || []) ||
      !eArrayDeString(es.perguntas_para_responsavel || [])
    ) {
      erros.push('Campo "estrategia" não corresponde ao formato esperado.')
    }
  }

  if (obj.abordagem !== undefined) {
    const ab = obj.abordagem
    if (!ab || typeof ab !== 'object' || !eString(ab.mensagem_whatsapp) || !eString(ab.versao_curta)) {
      erros.push('Campo "abordagem" deveria ter "mensagem_whatsapp" e "versao_curta" como strings.')
    }
  }

  return { valido: erros.length === 0, erros, dados: erros.length === 0 ? normalizar(obj) : null }
}

/**
 * Preenche valores ausentes (campos opcionais) com defaults neutros — nunca
 * inventa CONTEÚDO, só garante que o shape sempre tem todas as chaves pra
 * UI não precisar de encadeamento de "?." em todo lugar.
 */
function normalizar(obj) {
  return {
    resumo_comercial: obj.resumo_comercial,
    oportunidade_principal: obj.oportunidade_principal,
    evidencias_utilizadas: obj.evidencias_utilizadas || [],
    hipoteses: obj.hipoteses || [],
    servico_recomendado: obj.servico_recomendado || null,
    estrategia: obj.estrategia || null,
    abordagem: obj.abordagem || null,
    limitacoes: obj.limitacoes || [],
  }
}

/**
 * Validação (mais leve) específica para a tarefa 'gerar_abordagem', que só
 * precisa do campo "abordagem" preenchido — os demais campos continuam
 * aceitos se vierem, mas não são obrigatórios (ver promptComercial.js).
 */
export function validarAbordagem(textoResposta) {
  const geral = validarAnaliseComercial(textoResposta)
  if (!geral.dados) return geral
  if (!geral.dados.abordagem) {
    return { valido: false, erros: ['Campo "abordagem" ausente na resposta.'], dados: null }
  }
  return geral
}
