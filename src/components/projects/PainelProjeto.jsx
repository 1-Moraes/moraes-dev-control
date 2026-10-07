// Painel panorâmico de Projeto — a NOVA experiência principal de detalhes
// no desktop (itens 4-17 do planejamento da Fase 2E). Substitui o antigo
// drawer lateral estreito: horizontal, centralizado, proporção ~2:1,
// backdrop desfocado. No mobile reorganiza em coluna (item 17).
//
// Modo padrão é LEITURA (item 14) — [Editar projeto] alterna para edição
// só dos campos apropriados (nome/serviço/prioridade/responsável/início/
// prazo/valor/descrição/observações); status muda pelo select/Kanban.
import { useEffect, useState } from 'react'
import { X, Loader2, MessageCircle, Phone, Globe, ArrowRightCircle } from 'lucide-react'
import {
  PRIORIDADES_PROJETO,
  STATUS_PROJETO,
  STATUS_PROJETO_LABEL,
  listarTarefasProjeto,
  listarAtividadesProjeto,
  listarServicos,
  atualizarProjeto,
  moverEtapaProjeto,
  calcularProgressoTarefas,
} from '../../lib/projects/ProjectsService'
import { formatarMoeda } from '../../lib/helpers'
import TimelineEtapas from './TimelineEtapas'
import ChipPrazo from './ChipPrazo'
import SubpainelTarefas from './SubpainelTarefas'
import SubpainelProjeto from './SubpainelProjeto'

function telefoneParaWhatsapp(telefone) {
  if (!telefone) return null
  const digitos = telefone.replace(/\D/g, '')
  if (!digitos) return null
  return `https://wa.me/55${digitos.replace(/^55/, '')}`
}

function Campo({ label, children }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-(--color-ink-secondary)">{label}</dt>
      <dd className="mt-0.5 text-sm text-(--color-ink)">{children}</dd>
    </div>
  )
}

function PainelProjetoConteudo({ projeto: projetoInicial, equipe, onFechar, onAbrirCliente, onVerLead, onProjetoAtualizado }) {
  const [projeto, setProjeto] = useState(projetoInicial)
  const [tarefas, setTarefas] = useState([])
  const [atividades, setAtividades] = useState([])
  const [servicos, setServicos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState(() => ({ ...projetoInicial }))
  const [salvando, setSalvando] = useState(false)
  const [subpainel, setSubpainel] = useState(null) // 'tarefas' | { aba: 'briefing'|'links'|... }
  const [pedindoMotivo, setPedindoMotivo] = useState(null) // 'pausado' | 'cancelado'
  const [motivoDigitado, setMotivoDigitado] = useState('')

  function carregar() {
    return Promise.all([listarTarefasProjeto(projeto.id), listarAtividadesProjeto(projeto.id), listarServicos()])
      .then(([t, a, s]) => {
        setTarefas(t)
        setAtividades(a)
        setServicos(s)
      })
      .finally(() => setCarregando(false))
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem (componente é remontado por key={projeto.id} pelo chamador)
  }, [])

  useEffect(() => {
    function aoPressionarTecla(e) {
      if (e.key === 'Escape') tentarFechar()
    }
    document.addEventListener('keydown', aoPressionarTecla)
    return () => document.removeEventListener('keydown', aoPressionarTecla)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handler recriado a cada render é intencional (lê `editando` atual)
  }, [editando])

  function tentarFechar() {
    if (editando) {
      if (!window.confirm('Você tem alterações não salvas. Fechar sem salvar?')) return
    }
    onFechar()
  }

  function aoClicarBackdrop() {
    tentarFechar()
  }

  async function salvarEdicao() {
    setSalvando(true)
    try {
      const atualizado = await atualizarProjeto(projeto.id, {
        nome: rascunho.nome,
        service_id: rascunho.service_id || null,
        prioridade: rascunho.prioridade,
        responsavel_id: rascunho.responsavel_id || null,
        data_inicio: rascunho.data_inicio || null,
        prazo_previsto: rascunho.prazo_previsto || null,
        valor_contratado: rascunho.valor_contratado === '' ? null : rascunho.valor_contratado,
        descricao: rascunho.descricao || null,
        observacoes: rascunho.observacoes || null,
      }, 'Dados do projeto atualizados.')
      setProjeto(atualizado)
      onProjetoAtualizado?.(atualizado)
      setEditando(false)
      const a = await listarAtividadesProjeto(projeto.id)
      setAtividades(a)
    } finally {
      setSalvando(false)
    }
  }

  function cancelarEdicao() {
    setRascunho({ ...projeto })
    setEditando(false)
  }

  async function mudarEtapa(novoStatus) {
    if (novoStatus === 'pausado' || novoStatus === 'cancelado') {
      setPedindoMotivo(novoStatus)
      return
    }
    const atualizado = await moverEtapaProjeto(projeto, novoStatus)
    setProjeto(atualizado)
    onProjetoAtualizado?.(atualizado)
    const a = await listarAtividadesProjeto(projeto.id)
    setAtividades(a)
  }

  async function confirmarMotivo() {
    const atualizado = await moverEtapaProjeto(projeto, pedindoMotivo, { motivo: motivoDigitado.trim() || null })
    setProjeto(atualizado)
    onProjetoAtualizado?.(atualizado)
    setPedindoMotivo(null)
    setMotivoDigitado('')
    const a = await listarAtividadesProjeto(projeto.id)
    setAtividades(a)
  }

  function atualizarAposSubpainel(atualizado) {
    setProjeto(atualizado)
    onProjetoAtualizado?.(atualizado)
  }

  async function recarregarTarefas() {
    const t = await listarTarefasProjeto(projeto.id)
    setTarefas(t)
    const a = await listarAtividadesProjeto(projeto.id)
    setAtividades(a)
  }

  const linkWhatsapp = telefoneParaWhatsapp(projeto.cliente?.whatsapp || projeto.cliente?.telefone)
  const progresso = calcularProgressoTarefas(tarefas)
  const emEstadoComplementar = projeto.status === 'pausado' || projeto.status === 'cancelado'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Painel do projeto ${projeto.nome}`}>
      <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={aoClicarBackdrop} />

      <div
        className="relative flex max-h-[calc(100vh-24px)] w-full flex-col overflow-hidden rounded-3xl border border-(--color-line) bg-(--color-surface) shadow-2xl sm:max-h-[calc(100vh-48px)] lg:w-[min(1320px,calc(100vw-80px))]"
        style={{ aspectRatio: 'auto' }}
      >
        <div className="flex items-center justify-between border-b border-(--color-line) px-5 py-3 sm:px-8">
          <img src="/brand/logo-moraes-dev-horizontal.png" alt="Moraes.Dev" className="h-6 w-auto sm:h-7" style={{ maxWidth: '120px' }} />
          <button type="button" onClick={tentarFechar} className="rounded-lg p-1.5 text-(--color-ink-secondary) hover:bg-(--color-canvas)" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-8">
          {/* Cabeçalho do projeto (item 9) */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {editando ? (
                <input
                  value={rascunho.nome}
                  onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
                  className="font-display w-full max-w-sm rounded-lg border border-(--color-line) bg-(--color-canvas) px-2 py-1 text-lg font-semibold text-(--color-ink) outline-none focus:border-(--color-primary)"
                />
              ) : (
                <h1 className="font-display truncate text-lg font-semibold text-(--color-ink) sm:text-xl">{projeto.nome}</h1>
              )}
              <p className="mt-0.5 truncate text-xs text-(--color-ink-secondary)">{projeto.cliente?.nome_empresa}</p>
            </div>
            <div className="flex flex-col items-end gap-0.5 text-right">
              <span className="text-xs font-semibold uppercase tracking-wide text-(--color-ink-secondary)">{projeto.servico?.nome || 'Sem serviço definido'}</span>
              <span className="font-display text-base font-semibold text-(--color-ink)">{formatarMoeda(projeto.valor_contratado)}</span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-(--color-primary)">
                <span className="h-1.5 w-1.5 rounded-full bg-(--color-primary)" /> {STATUS_PROJETO_LABEL[projeto.status] || projeto.status}
              </span>
            </div>
          </div>

          {/* Timeline (item 10-11) */}
          <div className="mt-4">
            {emEstadoComplementar ? (
              <p className="mb-2 text-[11px] font-semibold text-(--color-ink-secondary)">
                Timeline congelada — projeto {STATUS_PROJETO_LABEL[projeto.status].toLowerCase()}
                {projeto.status === 'pausado' && projeto.motivo_pausa ? `: ${projeto.motivo_pausa}` : ''}
                {projeto.status === 'cancelado' && projeto.motivo_cancelamento ? `: ${projeto.motivo_cancelamento}` : ''}
              </p>
            ) : null}
            <TimelineEtapas status={projeto.status} />
            <div className="mt-2 flex items-center gap-2">
              <label className="text-[11px] font-medium text-(--color-ink-secondary)">Mudar etapa:</label>
              <select
                value={projeto.status}
                onChange={(e) => mudarEtapa(e.target.value)}
                className="rounded-lg border border-(--color-line) bg-(--color-surface) px-2 py-1 text-xs text-(--color-ink) outline-none focus:border-(--color-primary)"
              >
                {STATUS_PROJETO.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Três blocos (item 12) */}
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-(--color-line) bg-(--color-canvas) p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wide text-(--color-ink-secondary)">Cliente</h3>
              <dl className="mt-2 space-y-1.5">
                <Campo label="Nome">{projeto.cliente?.nome_empresa || '—'}</Campo>
                <Campo label="Telefone">{projeto.cliente?.telefone || '—'}</Campo>
                <Campo label="Cidade/UF">{[projeto.cliente?.cidade, projeto.cliente?.estado].filter(Boolean).join(', ') || '—'}</Campo>
              </dl>
              <div className="mt-2 flex gap-1.5">
                {linkWhatsapp ? (
                  <a href={linkWhatsapp} target="_blank" rel="noreferrer" className="rounded-lg border border-(--color-line) p-1.5 text-(--color-ink-secondary) hover:bg-(--color-surface)" title="WhatsApp">
                    <MessageCircle size={13} />
                  </a>
                ) : null}
                {projeto.cliente?.telefone ? (
                  <a href={`tel:${projeto.cliente.telefone}`} className="rounded-lg border border-(--color-line) p-1.5 text-(--color-ink-secondary) hover:bg-(--color-surface)" title="Ligar">
                    <Phone size={13} />
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => onAbrirCliente(projeto.client_id)}
                  className="flex items-center gap-1 rounded-lg border border-(--color-line) px-2 py-1 text-[11px] font-semibold text-(--color-ink) hover:bg-(--color-surface)"
                >
                  <Globe size={11} /> Abrir cliente
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-(--color-line) bg-(--color-canvas) p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wide text-(--color-ink-secondary)">Projeto</h3>
              <dl className="mt-2 space-y-1.5">
                <Campo label="Serviço">
                  {editando ? (
                    <select
                      value={rascunho.service_id || ''}
                      onChange={(e) => setRascunho((r) => ({ ...r, service_id: e.target.value || null }))}
                      className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-1.5 py-1 text-xs text-(--color-ink)"
                    >
                      <option value="">Sem serviço</option>
                      {servicos.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  ) : (
                    projeto.servico?.nome || '—'
                  )}
                </Campo>
                <Campo label="Valor contratado">
                  {editando ? (
                    <input
                      value={rascunho.valor_contratado ?? ''}
                      onChange={(e) => setRascunho((r) => ({ ...r, valor_contratado: e.target.value }))}
                      placeholder="0,00"
                      className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-1.5 py-1 text-xs text-(--color-ink)"
                    />
                  ) : (
                    formatarMoeda(projeto.valor_contratado)
                  )}
                </Campo>
                <Campo label="Prioridade">
                  {editando ? (
                    <select
                      value={rascunho.prioridade}
                      onChange={(e) => setRascunho((r) => ({ ...r, prioridade: e.target.value }))}
                      className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-1.5 py-1 text-xs text-(--color-ink)"
                    >
                      {PRIORIDADES_PROJETO.map((p) => (
                        <option key={p.valor} value={p.valor}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="capitalize">{projeto.prioridade}</span>
                  )}
                </Campo>
              </dl>
            </div>

            <div className="rounded-2xl border border-(--color-line) bg-(--color-canvas) p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wide text-(--color-ink-secondary)">Prazos / Responsável</h3>
              <dl className="mt-2 space-y-1.5">
                <Campo label="Responsável">
                  {editando ? (
                    <select
                      value={rascunho.responsavel_id || ''}
                      onChange={(e) => setRascunho((r) => ({ ...r, responsavel_id: e.target.value || null }))}
                      className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-1.5 py-1 text-xs text-(--color-ink)"
                    >
                      <option value="">Sem responsável</option>
                      {equipe.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome}
                        </option>
                      ))}
                    </select>
                  ) : (
                    projeto.responsavel?.nome || '—'
                  )}
                </Campo>
                <Campo label="Início / Prazo previsto">
                  {editando ? (
                    <div className="flex gap-1.5">
                      <input
                        type="date"
                        value={rascunho.data_inicio || ''}
                        onChange={(e) => setRascunho((r) => ({ ...r, data_inicio: e.target.value }))}
                        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-1.5 py-1 text-xs text-(--color-ink)"
                      />
                      <input
                        type="date"
                        value={rascunho.prazo_previsto || ''}
                        onChange={(e) => setRascunho((r) => ({ ...r, prazo_previsto: e.target.value }))}
                        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-1.5 py-1 text-xs text-(--color-ink)"
                      />
                    </div>
                  ) : (
                    <>
                      {projeto.data_inicio ? new Date(projeto.data_inicio).toLocaleDateString('pt-BR') : '—'}
                      {' → '}
                      {projeto.prazo_previsto ? new Date(projeto.prazo_previsto).toLocaleDateString('pt-BR') : '—'}
                    </>
                  )}
                </Campo>
                <Campo label="Situação">
                  <ChipPrazo prazoPrevisto={projeto.prazo_previsto} status={projeto.status} />
                </Campo>
              </dl>
            </div>
          </div>

          {/* Escopo / Observações (item 13) */}
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-(--color-line) p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wide text-(--color-ink-secondary)">Escopo / Descrição</h3>
              {editando ? (
                <textarea
                  value={rascunho.descricao || ''}
                  onChange={(e) => setRascunho((r) => ({ ...r, descricao: e.target.value }))}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-lg border border-(--color-line) bg-(--color-surface) px-2.5 py-2 text-sm text-(--color-ink) outline-none"
                />
              ) : (
                <p className="mt-2 text-sm text-(--color-ink-secondary)">{projeto.descricao || 'Sem escopo registrado.'}</p>
              )}
            </div>
            <div className="rounded-2xl border border-(--color-line) p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wide text-(--color-ink-secondary)">Observações</h3>
              {editando ? (
                <textarea
                  value={rascunho.observacoes || ''}
                  onChange={(e) => setRascunho((r) => ({ ...r, observacoes: e.target.value }))}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-lg border border-(--color-line) bg-(--color-surface) px-2.5 py-2 text-sm text-(--color-ink) outline-none"
                />
              ) : (
                <p className="mt-2 text-sm text-(--color-ink-secondary)">{projeto.observacoes || 'Sem observações.'}</p>
              )}
            </div>
          </div>

          {/* Tarefas resumo + Atividade recente (itens 27/37/45) */}
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <button
              type="button"
              onClick={() => setSubpainel('tarefas')}
              className="rounded-2xl border border-(--color-line) p-3 text-left hover:bg-(--color-canvas)"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-(--color-ink-secondary)">Tarefas</h3>
                <span className="text-[11px] font-semibold text-(--color-primary)">Ver tarefas</span>
              </div>
              <p className="mt-1 text-sm text-(--color-ink)">
                {progresso.concluidas}/{progresso.total} concluídas {progresso.total > 0 ? `· ${progresso.percentual}%` : ''}
              </p>
            </button>

            <div className="rounded-2xl border border-(--color-line) p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-(--color-ink-secondary)">Atividade recente</h3>
                <button type="button" onClick={() => setSubpainel({ secao: 'historico' })} className="text-[11px] font-semibold text-(--color-primary)">
                  Ver histórico completo
                </button>
              </div>
              <div className="mt-1 space-y-1.5">
                {carregando ? (
                  <Loader2 size={14} className="animate-spin text-(--color-ink-secondary)" />
                ) : atividades.length === 0 ? (
                  <p className="text-xs text-(--color-ink-secondary)">Nenhuma atividade registrada.</p>
                ) : (
                  atividades.slice(0, 2).map((a) => (
                    <div key={a.id} className="text-xs">
                      <p className="text-(--color-ink)">{a.descricao}</p>
                      <p className="text-[10px] text-(--color-ink-secondary)">{new Date(a.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Acesso rápido às demais áreas (briefing/arquivos/links/infra/alterações/deploys) */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {[
              ['briefing', 'Briefing'],
              ['arquivos', 'Arquivos'],
              ['links', 'Links'],
              ['infra', 'Infraestrutura'],
              ['alteracoes', 'Alterações'],
              ['deploys', 'Deploys'],
            ].map(([chave, label]) => (
              <button
                key={chave}
                type="button"
                onClick={() => setSubpainel({ aba: chave })}
                className="rounded-full border border-(--color-line) px-3 py-1 text-[11px] font-semibold text-(--color-ink-secondary) hover:bg-(--color-canvas) hover:text-(--color-ink)"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Rodapé (item 15) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--color-line) bg-(--color-canvas) px-5 py-3 sm:px-8">
          <div className="flex gap-2">
            {linkWhatsapp ? (
              <a href={linkWhatsapp} target="_blank" rel="noreferrer" className="rounded-xl border border-(--color-line) bg-(--color-surface) px-3 py-1.5 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)">
                WhatsApp
              </a>
            ) : null}
            <button type="button" onClick={() => onAbrirCliente(projeto.client_id)} className="rounded-xl border border-(--color-line) bg-(--color-surface) px-3 py-1.5 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)">
              Ver cliente
            </button>
            {projeto.origin_lead_id ? (
              <button
                type="button"
                onClick={() => onVerLead(projeto.origin_lead_id)}
                className="flex items-center gap-1 rounded-xl border border-(--color-line) bg-(--color-surface) px-3 py-1.5 text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)"
              >
                Ver lead <ArrowRightCircle size={12} />
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {editando ? (
              <>
                <button type="button" onClick={cancelarEdicao} disabled={salvando} className="rounded-xl border border-(--color-line) px-4 py-1.5 text-xs font-semibold text-(--color-ink) hover:bg-(--color-surface)">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={salvarEdicao}
                  disabled={salvando}
                  className="flex items-center gap-1.5 rounded-xl bg-(--color-primary) px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {salvando ? <Loader2 size={13} className="animate-spin" /> : null} Salvar
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setEditando(true)} className="rounded-xl border border-(--color-line) px-4 py-1.5 text-xs font-semibold text-(--color-ink) hover:bg-(--color-surface)">
                  Editar projeto
                </button>
                <button type="button" onClick={tentarFechar} className="rounded-xl bg-(--color-primary) px-4 py-1.5 text-xs font-semibold text-white hover:bg-(--color-primary-hover)">
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confirmação de motivo ao pausar/cancelar (item 22) */}
      {pedindoMotivo ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/40" onClick={() => setPedindoMotivo(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-(--color-surface) p-5 shadow-xl">
            <h3 className="font-display text-sm font-semibold text-(--color-ink)">
              {pedindoMotivo === 'pausado' ? 'Pausar projeto' : 'Cancelar projeto'}
            </h3>
            <p className="mt-1 text-xs text-(--color-ink-secondary)">
              {pedindoMotivo === 'pausado' ? 'Motivo (opcional):' : 'Esta ação não exclui o projeto — ele continua consultável. Motivo:'}
            </p>
            <textarea
              value={motivoDigitado}
              onChange={(e) => setMotivoDigitado(e.target.value)}
              rows={2}
              className="mt-2 w-full resize-none rounded-lg border border-(--color-line) bg-(--color-canvas) px-2.5 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-primary)"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setPedindoMotivo(null)} className="rounded-xl border border-(--color-line) px-3 py-1.5 text-xs font-semibold text-(--color-ink)">
                Cancelar
              </button>
              <button type="button" onClick={confirmarMotivo} className="rounded-xl bg-(--color-primary) px-3 py-1.5 text-xs font-semibold text-white">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SubpainelTarefas
        aberto={subpainel === 'tarefas'}
        tarefas={tarefas}
        equipe={equipe}
        projectId={projeto.id}
        onFechar={() => setSubpainel(null)}
        onRecarregar={recarregarTarefas}
      />

      {subpainel && typeof subpainel === 'object' && subpainel.aba ? (
        <SubpainelProjeto projeto={projeto} abaInicial={subpainel.aba} onFechar={() => setSubpainel(null)} onProjetoAtualizado={atualizarAposSubpainel} />
      ) : null}

      {subpainel && typeof subpainel === 'object' && subpainel.secao === 'historico' ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSubpainel(null)} />
          <div className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-(--color-surface) shadow-xl">
            <div className="flex items-center justify-between border-b border-(--color-line) px-4 py-3">
              <h2 className="font-display text-sm font-semibold text-(--color-ink)">Histórico completo</h2>
              <button type="button" onClick={() => setSubpainel(null)} className="rounded-lg p-1 text-(--color-ink-secondary) hover:bg-(--color-canvas)">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto border-l border-(--color-line) p-4 pl-6">
              {atividades.map((a) => (
                <div key={a.id} className="relative text-xs">
                  <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-(--color-primary)" />
                  <p className="text-(--color-ink)">{a.descricao}</p>
                  <p className="text-[10px] text-(--color-ink-secondary)">
                    {a.autor?.nome || 'Equipe'} · {new Date(a.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function PainelProjeto({ projeto, equipe, onFechar, onAbrirCliente, onVerLead, onProjetoAtualizado }) {
  if (!projeto) return null
  return (
    <PainelProjetoConteudo
      key={projeto.id}
      projeto={projeto}
      equipe={equipe}
      onFechar={onFechar}
      onAbrirCliente={onAbrirCliente}
      onVerLead={onVerLead}
      onProjetoAtualizado={onProjetoAtualizado}
    />
  )
}
