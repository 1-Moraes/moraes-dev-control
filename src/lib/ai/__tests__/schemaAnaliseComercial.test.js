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
