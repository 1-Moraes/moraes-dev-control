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

  it('sucesso: devolve dados estruturados, provider, model e contagem de uso', async () => {
    autenticarEAutorizar.mockResolvedValue({ autorizado: true, userId: 'u1', clienteSupabase: CLIENTE_FALSO })
    const jsonValido = JSON.stringify({ resumo_comercial: 'x', oportunidade_principal: 'y' })
    executar.mockResolvedValue({ texto: jsonValido, provider: 'anthropic', model: 'modelo-x', tokensEntrada: 10, tokensSaida: 5, duracaoMs: 100 })
    const res = fakeRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { tarefa: 'analisar_oportunidade', empresaCandidata: EMPRESA_VALIDA } }, res)
    expect(res._status).toBe(200)
    expect(res._body.status).toBe('ok')
    expect(res._body.dados.resumo_comercial).toBe('x')
    expect(res._body.provider).toBe('anthropic')
  })
})
