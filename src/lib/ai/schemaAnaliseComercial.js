// Validação estrutural da saída da IA — Fase 3B, item 13 do planejamento:
// "não confiar que o JSON retornado pelo modelo será sempre válido".
// Função pura, sem I/O, chamada por AIOrchestrator.js depois de qualquer
// provider responder, ANTES de a resposta seguir para o frontend ou ser
// persistida. Nunca lança — devolve {valido, erros, dados} para quem chama
// decidir o que fazer (log + erro `resposta_invalida`, nunca um crash).
//
// CORREÇÃO (investigação do 502 reportado em produção com Groq): o prompt
// de sistema já pede "sem markdown, sem texto antes ou depois" (ver
// promptComercial.js), mas modelos abertos servidos pelo Groq (Llama/
// GPT-OSS/Qwen) frequentemente ignoram essa instrução e devolvem o JSON
// envolto em um bloco de código Markdown (```json ... ```) ou com uma
// frase curta antes/depois ("Aqui está a análise:" / "Espero que ajude!").
// Isso nunca era culpa do modelo/chave em si — era o `JSON.parse` direto
// aqui falhando por um motivo puramente de formatação, e isso contava
// como `resposta_invalida` (502) mesmo com a análise, na prática, correta.
// `extrairJsonDeTexto` normaliza SÓ a camada externa de formatação antes
// do parse — a validação estrutural abaixo continua exatamente tão
// estrita quanto antes (nenhum campo passa a ser opcional, nenhuma regra
// foi afrouxada).

const CAMPOS_STRING_OBRIGATORIOS = ['resumo_comercial', 'oportunidade_principal']
const CAMPOS_ARRAY_STRING = ['evidencias_utilizadas', 'hipoteses', 'limitacoes']

function eString(v) {
  return typeof v === 'string'
}
function eArrayDeString(v) {
  return Array.isArray(v) && v.every((item) => typeof item === 'string')
}

const REGEX_BLOCO_MARKDOWN = /^```(?:json)?\s*([\s\S]*?)\s*```$/i

/**
 * Encontra o primeiro `{` e o `}` que fecha exatamente esse bloco
 * (contagem de chaves respeitando strings e escapes, para não parar num
 * `}` que só existe dentro de um valor de string). Usado só como ÚLTIMA
 * tentativa, depois que o texto já tentou ser interpretado como JSON puro
 * e sem o bloco Markdown — nunca "corrige" texto genuinamente malformado
 * (chaves desbalanceadas devolvem null, e quem chama cai de volta no erro
 * original de parse).
 * @param {string} texto
 * @returns {string|null}
 */
function extrairPrimeiroObjetoBalanceado(texto) {
  const inicio = texto.indexOf('{')
  if (inicio === -1) return null

  let profundidade = 0
  let dentroDeString = false
  let escapando = false

  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i]
    if (escapando) {
      escapando = false
      continue
    }
    if (c === '\\' && dentroDeString) {
      escapando = true
      continue
    }
    if (c === '"') {
      dentroDeString = !dentroDeString
      continue
    }
    if (dentroDeString) continue
    if (c === '{') profundidade++
    else if (c === '}') {
      profundidade--
      if (profundidade === 0) return texto.slice(inicio, i + 1)
    }
  }
  return null // chaves nunca fecharam — texto genuinamente malformado
}

/**
 * Remove só a "casca" de formatação mais comum em torno de um JSON antes
 * de tentar interpretá-lo — nunca tenta reparar o CONTEÚDO do JSON em si.
 * @param {string} textoResposta
 * @returns {{valor: Object|null, erro: string|null}}
 */
function tentarParseTolerante(textoResposta) {
  const bruto = typeof textoResposta === 'string' ? textoResposta.trim() : textoResposta

  try {
    return { valor: JSON.parse(bruto), erro: null }
  } catch {
    // segue para as tentativas tolerantes abaixo
  }

  if (typeof bruto === 'string') {
    const semBlocoMarkdown = bruto.match(REGEX_BLOCO_MARKDOWN)?.[1]?.trim()
    if (semBlocoMarkdown) {
      try {
        return { valor: JSON.parse(semBlocoMarkdown), erro: null }
      } catch {
        // segue para a extração por chaves balanceadas
      }
    }

    const objetoExtraido = extrairPrimeiroObjetoBalanceado(bruto)
    if (objetoExtraido) {
      try {
        return { valor: JSON.parse(objetoExtraido), erro: null }
      } catch {
        // nenhuma tentativa funcionou
      }
    }
  }

  return { valor: null, erro: 'Resposta não é um JSON válido.' }
}

/**
 * @param {unknown} textoResposta - texto bruto devolvido pelo provider (deve conter um JSON, eventualmente envolto em markdown/texto)
 * @returns {{valido: boolean, erros: string[], dados: Object|null}}
 */
export function validarAnaliseComercial(textoResposta) {
  const erros = []
  let obj

  const resultadoParse = tentarParseTolerante(textoResposta)
  if (resultadoParse.erro) {
    return { valido: false, erros: [resultadoParse.erro], dados: null }
  }
  obj = resultadoParse.valor

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
