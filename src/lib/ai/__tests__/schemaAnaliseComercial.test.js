import { describe, it, expect } from 'vitest'
import { validarAnaliseComercial, validarAbordagem } from '../schemaAnaliseComercial'

const RESPOSTA_VALIDA = JSON.stringify({
  resumo_comercial: 'Barbearia com boa avaliação, sem site próprio identificado.',
  oportunidade_principal: 'Uma página própria pode centralizar serviços e contato.',
  evidencias_utilizadas: ['Instagram identificado', 'Site próprio não identificado'],
  hipoteses: ['Pode estar perdendo clientes que preferem agendar online'],
  servico_recomendado: { tipo: 'Landing page', justificativa: 'Presença digital básica, foco em agendamento' },
  estrategia: {
    objetivo_primeiro_contato: 'Apresentar a ideia de uma página simples',
    pontos_para_conversa: ['Instagram já ativo'],
    perguntas_para_responsavel: ['Já pensou em ter uma página própria?'],
  },
  abordagem: { mensagem_whatsapp: 'Olá, tudo bem?', versao_curta: 'Olá!' },
  limitacoes: ['OSM não fornece avaliação de demanda'],
})

describe('schemaAnaliseComercial / validarAnaliseComercial', () => {
  it('aceita uma resposta estruturada completa e válida', () => {
    const r = validarAnaliseComercial(RESPOSTA_VALIDA)
    expect(r.valido).toBe(true)
    expect(r.erros).toEqual([])
    expect(r.dados.resumo_comercial).toContain('Barbearia')
    expect(r.dados.servico_recomendado.tipo).toBe('Landing page')
  })

  it('nunca lança — texto que não é JSON retorna valido:false, erros preenchidos', () => {
    expect(() => validarAnaliseComercial('isto não é json {{{')).not.toThrow()
    const r = validarAnaliseComercial('isto não é json {{{')
    expect(r.valido).toBe(false)
    expect(r.dados).toBeNull()
    expect(r.erros.length).toBeGreaterThan(0)
  })

  it('rejeita um array JSON (não é objeto)', () => {
    const r = validarAnaliseComercial('[1,2,3]')
    expect(r.valido).toBe(false)
  })

  it('rejeita quando falta resumo_comercial ou oportunidade_principal', () => {
    const r = validarAnaliseComercial(JSON.stringify({ oportunidade_principal: 'x' }))
    expect(r.valido).toBe(false)
    expect(r.erros.some((e) => e.includes('resumo_comercial'))).toBe(true)
  })

  it('rejeita servico_recomendado malformado (faltando justificativa)', () => {
    const base = JSON.parse(RESPOSTA_VALIDA)
    base.servico_recomendado = { tipo: 'Landing page' }
    const r = validarAnaliseComercial(JSON.stringify(base))
    expect(r.valido).toBe(false)
  })

  it('rejeita estrategia malformada (pontos_para_conversa não é array de string)', () => {
    const base = JSON.parse(RESPOSTA_VALIDA)
    base.estrategia.pontos_para_conversa = 'não é array'
    const r = validarAnaliseComercial(JSON.stringify(base))
    expect(r.valido).toBe(false)
  })

  it('rejeita abordagem malformada (mensagem_whatsapp ausente)', () => {
    const base = JSON.parse(RESPOSTA_VALIDA)
    delete base.abordagem.mensagem_whatsapp
    const r = validarAnaliseComercial(JSON.stringify(base))
    expect(r.valido).toBe(false)
  })

  it('normaliza campos opcionais ausentes para arrays vazios, nunca undefined', () => {
    const r = validarAnaliseComercial(JSON.stringify({ resumo_comercial: 'x', oportunidade_principal: 'y' }))
    expect(r.valido).toBe(true)
    expect(r.dados.evidencias_utilizadas).toEqual([])
    expect(r.dados.hipoteses).toEqual([])
    expect(r.dados.limitacoes).toEqual([])
    expect(r.dados.servico_recomendado).toBeNull()
  })
})

describe('schemaAnaliseComercial / tolerância a formatação (regressão do 502 em produção com Groq)', () => {
  // Investigação do 502 reportado com GROQ_API_KEY/GROQ_MODEL configurados
  // corretamente: o log da Vercel confirmou que a chamada a
  // api.groq.com/openai/v1/chat/completions teve sucesso e o log chegou a
  // ai_logs — ou seja, a causa nunca foi credencial/modelo. A causa real
  // era aqui: modelos abertos servidos pelo Groq (Llama/GPT-OSS/Qwen)
  // frequentemente ignoram a instrução "sem markdown" do prompt de
  // sistema e envolvem o JSON em um bloco de código, o que fazia
  // `JSON.parse` falhar e a resposta ser classificada como
  // `resposta_invalida` (502), mesmo com o conteúdo da análise correto.

  it('aceita JSON envolto em um bloco de código markdown ```json ... ``` (comportamento real observado em modelos Groq)', () => {
    const envolto = '```json\n' + RESPOSTA_VALIDA + '\n```'
    const r = validarAnaliseComercial(envolto)
    expect(r.valido).toBe(true)
    expect(r.dados.resumo_comercial).toContain('Barbearia')
  })

  it('aceita JSON envolto em um bloco de código markdown sem a palavra "json" (``` ... ```)', () => {
    const envolto = '```\n' + RESPOSTA_VALIDA + '\n```'
    const r = validarAnaliseComercial(envolto)
    expect(r.valido).toBe(true)
  })

  it('aceita JSON com um preâmbulo/posfácio em prosa fora do bloco de código', () => {
    const comTexto = `Aqui está a análise solicitada:\n\n${RESPOSTA_VALIDA}\n\nEspero que ajude!`
    const r = validarAnaliseComercial(comTexto)
    expect(r.valido).toBe(true)
    expect(r.dados.oportunidade_principal).toContain('centralizar')
  })

  it('continua rejeitando texto genuinamente malformado (chaves nunca balanceiam) — a tolerância não "conserta" conteúdo quebrado', () => {
    const r = validarAnaliseComercial('isto não é json {{{')
    expect(r.valido).toBe(false)
    expect(r.dados).toBeNull()
  })

  it('continua rejeitando um objeto estruturalmente inválido mesmo depois de extraído de dentro de um bloco markdown', () => {
    const invalidoDentroDeBloco = '```json\n' + JSON.stringify({ oportunidade_principal: 'só isso' }) + '\n```'
    const r = validarAnaliseComercial(invalidoDentroDeBloco)
    expect(r.valido).toBe(false)
    expect(r.erros.some((e) => e.includes('resumo_comercial'))).toBe(true)
  })

  it('não confunde chaves dentro de strings com o fim do objeto (ex.: "a: {b}" dentro de um valor)', () => {
    const base = JSON.parse(RESPOSTA_VALIDA)
    base.resumo_comercial = 'Texto contendo uma chave solta: } só pra confundir parser ingênuo'
    const comPreambulo = `Resultado:\n${JSON.stringify(base)}\nFim.`
    const r = validarAnaliseComercial(comPreambulo)
    expect(r.valido).toBe(true)
    expect(r.dados.resumo_comercial).toContain('chave solta')
  })
})

describe('schemaAnaliseComercial / validarAbordagem', () => {
  it('exige o campo abordagem preenchido mesmo quando o resto é mínimo', () => {
    const r = validarAbordagem(JSON.stringify({ resumo_comercial: 'x', oportunidade_principal: 'y' }))
    expect(r.valido).toBe(false)
  })

  it('aceita quando abordagem está presente', () => {
    const r = validarAbordagem(RESPOSTA_VALIDA)
    expect(r.valido).toBe(true)
    expect(r.dados.abordagem.mensagem_whatsapp).toBeTruthy()
  })
})
