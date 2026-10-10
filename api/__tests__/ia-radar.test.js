import { describe, it, expect, vi, beforeEach } from 'vitest'

// Testa o handler da rota de IA mockando toda a camada de domínio
// (AIOrchestrator/autenticacaoServidor/schema) — cobre os estados de
// segurança explicitamente exigidos pelo planejamento (item 35: usuário
// não autenticado, sem permissão, payload inválido, chave ausente,
// resposta fora do schema, limite de tamanho, exposição de segredo em
// erro).

vi.mock('../../src/lib/ai/AIOrchestrator.js', () => ({
  executar: vi.fn(),
  statusProviders: vi.fn(() => ({ algumConfigurado: true, providers: [] })),
}))
vi.mock('../../src/lib/ai/autenticacaoServidor.js', () => ({
  extrairBearerToken: vi.fn((headers) => headers?.authorization?.replace('Bearer ', '') || null),
  autenticarEAutorizar: vi.fn(),
  verificarLimiteUso: vi.fn(async () => ({ dentroDoLimite: true, usoAtual: 0 })),
}))

const { executar, statusProviders } = await import('../../src/lib/ai/AIOrchestrator.js')
const { autenticarEAutorizar, verificarLimiteUso } = await import('../../src/lib/ai/autenticacaoServidor.js')
const { default: handler } = await import('../ia-radar.js')

function fakeRes() {
  return {
    _status: 200,
    _body: null,
    status(c) {
      this._status = c
      return this
    },
    json(d) {
      this._body = d
      return this
    },
  }
}

const CLIENTE_FALSO = { from: () => ({ insert: async () => ({ error: null }) }) }
const EMPRESA_VALIDA = { name: 'Barbearia X', category: 'Barbearia', city: 'Cotia', state: 'SP' }

describe('api/ia-radar handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    statusProviders.mockReturnValue({ algumConfigurado: true, providers: [] })
    verificarLimiteUso.mockResolvedValue({ dentroDoLimite: true, usoAtual: 0 })
  })

  it('rejeita métodos que não são POST', async () => {
    const res = fakeRes()
    await handler({ method: 'GET', headers: {}, body: {} }, res)
    expect(res._status).toBe(405)
  })

  it('usuário não autenticado (token ausente) -> 401, nunca chega a chamar a IA', async () => {
    autenticarEAutorizar.mockResolvedValue({ autorizado: false, motivo: 'token_ausente' })
    const res = fakeRes()
    await handler({ method: 'POST', headers: {}, body: { tarefa: 'analisar_oportunidade', empresaCandidata: EMPRESA_VALIDA } }, res)
    expect(res._status).toBe(401)
    expect(res._body.estado).toBe('token_ausente')
    expect(executar).not.toHaveBeenCalled()
  })

  it('usuário sem permissão (sem papel em user_roles) -> 403', async () => {
    autenticarEAutorizar.mockResolvedValue({ autorizado: false, motivo: 'sem_permissao' })
    const res = fakeRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { tarefa: 'analisar_oportunidade', empresaCandidata: EMPRESA_VALIDA } }, res)
    expect(res._status).toBe(403)
  })

  it('payload inválido (tarefa desconhecida) -> 400, mesmo autenticado', async () => {
    autenticarEAutorizar.mockResolvedValue({ autorizado: true, userId: 'u1', clienteSupabase: CLIENTE_FALSO })
    const res = fakeRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { tarefa: 'apagar_tudo', empresaCandidata: EMPRESA_VALIDA } }, res)
    expect(res._status).toBe(400)
    expect(executar).not.toHaveBeenCalled()
  })

  it('payload inválido (empresaCandidata ausente) -> 400', async () => {
    autenticarEAutorizar.mockResolvedValue({ autorizado: true, userId: 'u1', clienteSupabase: CLIENTE_FALSO })
    const res = fakeRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { tarefa: 'analisar_oportunidade' } }, res)
    expect(res._status).toBe(400)
  })

  it('payload maior que o limite de tamanho -> 413', async () => {
    autenticarEAutorizar.mockResolvedValue({ autorizado: true, userId: 'u1', clienteSupabase: CLIENTE_FALSO })
    const res = fakeRes()
    const empresaEnorme = { ...EMPRESA_VALIDA, lixo: 'x'.repeat(30000) }
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { tarefa: 'analisar_oportunidade', empresaCandidata: empresaEnorme } }, res)
    expect(res._status).toBe(413)
  })

  it('limite de utilização por hora atingido -> 429, nunca chama a IA', async () => {
    autenticarEAutorizar.mockResolvedValue({ autorizado: true, userId: 'u1', clienteSupabase: CLIENTE_FALSO })
    verificarLimiteUso.mockResolvedValue({ dentroDoLimite: false, usoAtual: 30 })
    const res = fakeRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { tarefa: 'analisar_oportunidade', empresaCandidata: EMPRESA_VALIDA } }, res)
    expect(res._status).toBe(429)
    expect(executar).not.toHaveBeenCalled()
  })

  it('IA não configurada (nenhum provider) -> 200 com status "nao_configurada", nunca 500', async () => {
    autenticarEAutorizar.mockResolvedValue({ autorizado: true, userId: 'u1', clienteSupabase: CLIENTE_FALSO })
    statusProviders.mockReturnValue({ algumConfigurado: false, providers: [] })
    const res = fakeRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { tarefa: 'analisar_oportunidade', empresaCandidata: EMPRESA_VALIDA } }, res)
    expect(res._status).toBe(200)
    expect(res._body.status).toBe('nao_configurada')
    expect(executar).not.toHaveBeenCalled()
  })

  it('resposta da IA fora do schema -> 502 "resposta_invalida", nunca repassa o texto cru do provider ao cliente', async () => {
    autenticarEAutorizar.mockResolvedValue({ autorizado: true, userId: 'u1', clienteSupabase: CLIENTE_FALSO })
    executar.mockResolvedValue({ texto: 'não é json', provider: 'anthropic', model: 'm', tokensEntrada: 1, tokensSaida: 1, duracaoMs: 5 })
    const res = fakeRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { tarefa: 'analisar_oportunidade', empresaCandidata: EMPRESA_VALIDA } }, res)
    expect(res._status).toBe(502)
    expect(res._body.estado).toBe('resposta_invalida')
    expect(JSON.stringify(res._body)).not.toContain('não é json')
  })

  it('erro do provider nunca expõe texto cru/segredo ao cliente, só um estado classificado', async () => {
    autenticarEAutorizar.mockResolvedValue({ autorizado: true, userId: 'u1', clienteSupabase: CLIENTE_FALSO })
    const erro = new Error('Anthropic rejeitou a credencial sk-SEGREDO-123')
    erro.tipo = 'credencial_invalida'
    erro.tentativas = [{ provider: 'anthropic', sucesso: false, tipoErro: 'credencial_invalida' }]
    executar.mockRejectedValue(erro)
    const res = fakeRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { tarefa: 'analisar_oportunidade', empresaCandidata: EMPRESA_VALIDA } }, res)
    expect(res._status).toBe(502)
    expect(JSON.stringify(res._body)).not.toContain('SEGREDO')
  })

  it('sucesso: devolve dados estruturados, provider, model, contagem de uso e um requestId de correlação', async () => {
    autenticarEAutorizar.mockResolvedValue({ autorizado: true, userId: 'u1', clienteSupabase: CLIENTE_FALSO })
    const jsonValido = JSON.stringify({ resumo_comercial: 'x', oportunidade_principal: 'y' })
    executar.mockResolvedValue({ texto: jsonValido, provider: 'anthropic', model: 'modelo-x', tokensEntrada: 10, tokensSaida: 5, duracaoMs: 100 })
    const res = fakeRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { tarefa: 'analisar_oportunidade', empresaCandidata: EMPRESA_VALIDA } }, res)
    expect(res._status).toBe(200)
    expect(res._body.status).toBe('ok')
    expect(res._body.dados.resumo_comercial).toBe('x')
    expect(res._body.provider).toBe('anthropic')
    expect(res._body.requestId).toBeTruthy()
  })

  // Regressão direta do 502 investigado em produção (Groq configurado
  // corretamente, chamada bem-sucedida confirmada pelos logs da Vercel, mas
  // a análise não concluía): o provider devolve o JSON correto envolto em
  // um bloco de código markdown, exatamente como modelos Groq fazem na
  // prática mesmo com a instrução "sem markdown" no prompt de sistema —
  // isso NÃO pode mais virar 502 depois da correção em
  // schemaAnaliseComercial.js.
  it('REGRESSÃO (502 em produção com Groq): JSON válido envolto em ```json ... ``` ainda assim conclui com sucesso (nunca mais 502 só por formatação)', async () => {
    autenticarEAutorizar.mockResolvedValue({ autorizado: true, userId: 'u1', clienteSupabase: CLIENTE_FALSO })
    const jsonEnvolto = '```json\n' + JSON.stringify({ resumo_comercial: 'Resumo real', oportunidade_principal: 'Oportunidade real' }) + '\n```'
    executar.mockResolvedValue({ texto: jsonEnvolto, provider: 'groq', model: 'llama-3.1-8b-instant', tokensEntrada: 20, tokensSaida: 15, duracaoMs: 300 })
    const res = fakeRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { tarefa: 'analisar_oportunidade', empresaCandidata: EMPRESA_VALIDA } }, res)
    expect(res._status).toBe(200)
    expect(res._body.status).toBe('ok')
    expect(res._body.provider).toBe('groq')
    expect(res._body.dados.resumo_comercial).toBe('Resumo real')
  })

  it('erro de provider: a resposta ao cliente sempre inclui um requestId, mesmo sem detalhe cru do provedor', async () => {
    autenticarEAutorizar.mockResolvedValue({ autorizado: true, userId: 'u1', clienteSupabase: CLIENTE_FALSO })
    const erro = new Error('Groq sinalizou limite de uso do free tier (HTTP 429).')
    erro.tipo = 'limite'
    erro.statusHttp = 429
    erro.etapa = 'chamada_provider'
    erro.tentativas = [{ provider: 'groq', sucesso: false, tipoErro: 'limite' }]
    executar.mockRejectedValue(erro)
    const res = fakeRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { tarefa: 'analisar_oportunidade', empresaCandidata: EMPRESA_VALIDA } }, res)
    expect(res._status).toBe(502)
    expect(res._body.estado).toBe('limite_provedor')
    expect(res._body.requestId).toBeTruthy()
    expect(res._body.mensagemErro).toContain('cota gratuita')
  })

  // Regressão direta do diagnóstico definitivo do 502 em produção
  // (requestId 1474521c-8236-4c3a-a45e-be7022a5d11b, confirmado via
  // Supabase ai_logs: provider=groq, statusHttp=404, etapa=chamada_provider,
  // tipo=desconhecido): até esta correção, `registrarLog` sempre escrevia
  // `model: 'desconhecido'` em QUALQUER falha de provider — mesmo quando
  // o próprio AIOrchestrator/provider já sabia qual modelo (GROQ_MODEL)
  // tinha sido tentado, que era exatamente a causa real do erro (modelo
  // inexistente/descontinuado). Isso nunca pode voltar a acontecer: o
  // `model` gravado em ai_logs precisa refletir o modelo da última
  // tentativa sempre que o provider/orquestrador o informar.
  it('erro de provider com modelo conhecido na última tentativa: ai_logs.model usa esse modelo, nunca "desconhecido"', async () => {
    const chamadasInsert = []
    const clienteComCaptura = {
      from: () => ({
        insert: async (linha) => {
          chamadasInsert.push(linha)
          return { error: null }
        },
      }),
    }
    autenticarEAutorizar.mockResolvedValue({ autorizado: true, userId: 'u1', clienteSupabase: clienteComCaptura })
    const erro = new Error('Groq respondeu HTTP 404 (não classificado). Detalhe da Groq: model_not_found: The model `llama3-70b-8192` does not exist or you do not have access to it.')
    erro.tipo = 'desconhecido'
    erro.statusHttp = 404
    erro.etapa = 'chamada_provider'
    erro.tentativas = [{ provider: 'groq', sucesso: false, tipoErro: 'desconhecido', modelo: 'llama3-70b-8192' }]
    executar.mockRejectedValue(erro)
    const res = fakeRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { tarefa: 'analisar_oportunidade', empresaCandidata: EMPRESA_VALIDA } }, res)
    expect(res._status).toBe(502)
    expect(res._body.estado).toBe('erro')
    expect(chamadasInsert).toHaveLength(1)
    expect(chamadasInsert[0].provider).toBe('groq')
    expect(chamadasInsert[0].model).toBe('llama3-70b-8192')
    expect(chamadasInsert[0].erro).toContain('statusHttpProvedor=404')
  })

  it('erro de provider SEM modelo informado na tentativa (ex.: credencial_ausente) ainda cai em "desconhecido" com segurança', async () => {
    const chamadasInsert = []
    const clienteComCaptura = {
      from: () => ({
        insert: async (linha) => {
          chamadasInsert.push(linha)
          return { error: null }
        },
      }),
    }
    autenticarEAutorizar.mockResolvedValue({ autorizado: true, userId: 'u1', clienteSupabase: clienteComCaptura })
    const erro = new Error('groq não configurado.')
    erro.tipo = 'credencial_ausente'
    erro.tentativas = [{ provider: 'groq', sucesso: false, tipoErro: 'credencial_ausente' }]
    executar.mockRejectedValue(erro)
    const res = fakeRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { tarefa: 'analisar_oportunidade', empresaCandidata: EMPRESA_VALIDA } }, res)
    expect(chamadasInsert[0].model).toBe('desconhecido')
  })
})
