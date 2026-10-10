// PainelAnaliseIA — painel de IA Comercial (Fase 3B), compartilhado entre
// o Radar (DrawerAnaliseLead.jsx, candidato ainda não-CRM) e o CRM
// (DrawerLead.jsx, lead já persistido). Mesmo componente nas duas telas
// (item 21 do planejamento: "deve parecer nativo ao app, nunca um chat
// genérico colado") — quem muda é o que as props permitem fazer:
//   - Radar-only (leadId=null): pode analisar/gerar abordagem, mas
//     [Salvar análise] fica desabilitado (nada para persistir ainda).
//   - CRM (leadId definido): [Salvar análise] disponível, e
//     [Abrir WhatsApp] registra o rascunho em lead_messages.
//
// Este componente NUNCA chama api/ia-radar.js diretamente — só via
// AIService.js (analisarOportunidade/gerarAbordagem). NUNCA envia
// mensagens automaticamente: "Abrir WhatsApp" só abre wa.me num link, o
// envio em si é manual, fora deste sistema.
import { useState } from 'react'
import { Sparkles, Loader2, AlertTriangle, Copy, Pencil, RotateCcw, Send, Save, Check, Clock } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { analisarOportunidade, gerarAbordagem } from '../../lib/ai/AIService'
import { salvarAnaliseIA, salvarAbordagemGerada, marcarMensagemComoAberta } from '../../lib/crm/LeadsService'

// Mensagens honestas por `estado` — nunca texto cru do provider/erro (ver
// api/ia-radar.js, que já garante isso no servidor; aqui só traduzimos o
// `estado` classificado para o usuário final).
const MENSAGEM_ESTADO = {
  ia_nao_configurada: 'IA ainda não configurada neste ambiente. É preciso cadastrar uma chave de API (Anthropic ou OpenAI) nas variáveis de ambiente do servidor antes de usar esta função.',
  token_ausente: 'Sessão não encontrada. Saia e entre novamente.',
  token_invalido: 'Sessão expirada. Saia e entre novamente.',
  sem_permissao: 'Seu usuário não tem permissão para executar análises de IA.',
  limite_utilizacao: 'Limite de análises de IA por hora atingido. Tente novamente mais tarde.',
  limite_provedor: 'A cota gratuita de IA foi esgotada por agora. Tente novamente mais tarde — o Radar e o CRM continuam funcionando normalmente.',
  provedor_indisponivel: 'O provedor de IA está indisponível agora. Tente novamente em alguns instantes.',
  resposta_invalida: 'A IA respondeu em um formato inesperado. Tente novamente.',
  payload_invalido: 'Dados insuficientes para analisar esta empresa.',
  payload_muito_grande: 'Dados desta empresa excedem o limite permitido para análise.',
  erro: 'Não foi possível concluir a análise de IA agora. Tente novamente em alguns instantes.',
}

function telefoneParaWhatsapp(tel) {
  if (!tel) return null
  const digitos = tel.replace(/\D/g, '')
  if (!digitos) return null
  const comPais = digitos.startsWith('55') ? digitos : `55${digitos}`
  return `https://wa.me/${comPais}`
}

/**
 * @param {Object} props
 * @param {Object} props.empresaCandidata - lead/candidato, shape mínimo aceito por sanitizarDadosEmpresa (Radar camelCase OU CRM snake_case)
 * @param {Object} props.analise - AnaliseRadar (score/scoreVersion/classificacao/criterios/presenca) vigente
 * @param {string|null} [props.leadId] - null/undefined para candidato ainda só no Radar
 * @param {Object|null} [props.analiseIASalva] - { dados, provider, model, promptVersao } já persistida (lead_analysis), se houver — exibida sem precisar reanalisar
 * @param {boolean} [props.desatualizada] - resultado de LeadsService.analiseEstaDesatualizada(), quando aplicável
 * @param {() => void} [props.onAnaliseSalva] - chamado depois de [Salvar análise] com sucesso, para o pai recarregar a última análise
 */
export default function PainelAnaliseIA({ empresaCandidata, analise, leadId, analiseIASalva = null, desatualizada = false, onAnaliseSalva }) {
  const { session } = useAuth()
  const accessToken = session?.access_token

  const [estado, setEstado] = useState(analiseIASalva ? 'concluida' : 'idle') // idle | carregando | concluida | erro
  const [erroEstado, setErroEstado] = useState(null)
  const [resultado, setResultado] = useState(
    analiseIASalva ? { dados: analiseIASalva.dados, provider: analiseIASalva.provider, model: analiseIASalva.model, promptVersao: analiseIASalva.promptVersao } : null
  )
  const [salvo, setSalvo] = useState(Boolean(analiseIASalva))
  const [salvandoAnalise, setSalvandoAnalise] = useState(false)

  const [abordagem, setAbordagem] = useState(null) // { mensagem_whatsapp, versao_curta }
  const [gerandoAbordagem, setGerandoAbordagem] = useState(false)
  const [erroAbordagem, setErroAbordagem] = useState(null)
  const [mensagemEditada, setMensagemEditada] = useState('')
  const [editandoMensagem, setEditandoMensagem] = useState(false)
  const [mensagemSalvaId, setMensagemSalvaId] = useState(null)
  const [copiado, setCopiado] = useState(false)

  async function analisar() {
    setEstado('carregando')
    setErroEstado(null)
    const resp = await analisarOportunidade({ accessToken, empresaCandidata, analise, leadId })
    if (resp?.status === 'ok') {
      setResultado({ dados: resp.dados, provider: resp.provider, model: resp.model, promptVersao: resp.promptVersao })
      setEstado('concluida')
      setSalvo(false)
    } else {
      setErroEstado(resp?.estado || 'erro')
      setEstado('erro')
    }
  }

  async function salvarAnalise() {
    if (!leadId || !resultado) return
    setSalvandoAnalise(true)
    try {
      await salvarAnaliseIA(leadId, analise, resultado)
      setSalvo(true)
      onAnaliseSalva?.()
    } finally {
      setSalvandoAnalise(false)
    }
  }

  async function gerar(instrucoesAdicionais) {
    setGerandoAbordagem(true)
    setErroAbordagem(null)
    const resp = await gerarAbordagem({ accessToken, empresaCandidata, analise, leadId, instrucoesAdicionais })
    setGerandoAbordagem(false)
    if (resp?.status === 'ok' && resp.dados?.abordagem) {
      setAbordagem(resp.dados.abordagem)
      setMensagemEditada(resp.dados.abordagem.mensagem_whatsapp || '')
      setEditandoMensagem(false)
      setMensagemSalvaId(null)
    } else {
      setErroAbordagem(resp?.estado || 'erro')
    }
  }

  async function copiarMensagem() {
    try {
      await navigator.clipboard.writeText(mensagemEditada)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // Falha de clipboard (permissão do navegador, ambiente sem suporte)
      // não é um erro de IA — só não marca "copiado", sem travar o painel.
    }
  }

  async function abrirWhatsapp() {
    const link = telefoneParaWhatsapp(empresaCandidata?.phone || empresaCandidata?.telefone)
    if (leadId) {
      const salva = await salvarAbordagemGerada(leadId, { mensagemWhatsapp: mensagemEditada })
      if (salva?.id) {
        setMensagemSalvaId(salva.id)
        await marcarMensagemComoAberta(salva.id)
      }
    }
    if (link) window.open(link, '_blank', 'noopener,noreferrer')
  }

  const dados = resultado?.dados

  return (
    <div className="rounded-2xl border border-(--color-line) p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--color-ink-secondary)">
          <Sparkles size={13} className="text-(--color-primary)" /> Inteligência comercial (IA)
        </h3>
        {estado === 'concluida' && leadId ? (
          salvo ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-(--color-green)">
              <Check size={12} /> Salva
            </span>
          ) : (
            <button
              type="button"
              disabled={salvandoAnalise}
              onClick={salvarAnalise}
              className="flex items-center gap-1 rounded-lg bg-(--color-primary-bg) px-2.5 py-1 text-[11px] font-semibold text-(--color-primary) hover:bg-(--color-primary)/20 disabled:opacity-60"
            >
              {salvandoAnalise ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar análise
            </button>
          )
        ) : null}
      </div>

      {desatualizada ? (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-(--color-amber)/15 px-2.5 py-1.5 text-[11px] text-(--color-amber)">
          <Clock size={12} /> Esta análise foi gerada antes da última atualização das evidências deste lead. Considere reanalisar.
        </p>
      ) : null}

      {estado === 'idle' ? (
        <div className="mt-3">
          <p className="text-[11px] text-(--color-ink-secondary)">A IA interpreta o Opportunity Score já calculado e sugere um serviço, uma estratégia e uma mensagem de abordagem — ela nunca descobre empresas nem recalcula o score.</p>
          <button
            type="button"
            onClick={analisar}
            className="mt-3 flex items-center gap-1.5 rounded-xl bg-(--color-primary) px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            <Sparkles size={13} /> Analisar com IA
          </button>
        </div>
      ) : null}

      {estado === 'carregando' ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-(--color-ink-secondary)">
          <Loader2 size={14} className="animate-spin" /> Analisando com IA…
        </div>
      ) : null}

      {estado === 'erro' ? (
        <div className="mt-3">
          <p className="flex items-start gap-1.5 rounded-lg bg-(--color-danger)/10 px-2.5 py-1.5 text-[11px] text-(--color-danger)">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {MENSAGEM_ESTADO[erroEstado] || MENSAGEM_ESTADO.erro}
          </p>
          <button type="button" onClick={analisar} className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-(--color-primary) hover:underline">
            <RotateCcw size={11} /> Tentar novamente
          </button>
        </div>
      ) : null}

      {estado === 'concluida' && dados ? (
        <div className="mt-3 space-y-3 text-xs text-(--color-ink)">
          <div>
            <p className="font-semibold">{dados.resumo_comercial}</p>
            <p className="mt-1 text-(--color-ink-secondary)">{dados.oportunidade_principal}</p>
          </div>

          {dados.servico_recomendado?.tipo ? (
            <div className="rounded-xl bg-(--color-canvas) p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-(--color-ink-secondary)">Serviço recomendado</p>
              <p className="mt-1 font-semibold">{dados.servico_recomendado.tipo}</p>
              {dados.servico_recomendado.justificativa ? <p className="mt-0.5 text-(--color-ink-secondary)">{dados.servico_recomendado.justificativa}</p> : null}
            </div>
          ) : null}

          {dados.estrategia ? (
            <div className="rounded-xl bg-(--color-canvas) p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-(--color-ink-secondary)">Estratégia de abordagem</p>
              {dados.estrategia.objetivo_primeiro_contato ? <p className="mt-1">{dados.estrategia.objetivo_primeiro_contato}</p> : null}
              {dados.estrategia.pontos_para_conversa?.length ? (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-(--color-ink-secondary)">
                  {dados.estrategia.pontos_para_conversa.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {dados.hipoteses?.length ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-(--color-ink-secondary)">Hipóteses</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-(--color-ink-secondary)">
                {dados.hipoteses.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {dados.limitacoes?.length ? (
            <ul className="space-y-0.5 text-[11px] text-(--color-ink-secondary)">
              {dados.limitacoes.map((l, i) => (
                <li key={i} className="flex items-start gap-1">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" /> {l}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="text-[10px] text-(--color-ink-secondary)">
            {resultado.provider} · {resultado.model}
          </p>

          <div className="flex flex-wrap items-center gap-2 border-t border-(--color-line) pt-2.5">
            <button type="button" onClick={analisar} className="flex items-center gap-1 rounded-lg border border-(--color-line) px-2.5 py-1.5 text-[11px] font-semibold text-(--color-ink-secondary) hover:bg-(--color-canvas)">
              <RotateCcw size={11} /> Reanalisar
            </button>
            {!abordagem ? (
              <button
                type="button"
                disabled={gerandoAbordagem}
                onClick={() => gerar()}
                className="flex items-center gap-1 rounded-lg bg-(--color-primary) px-2.5 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {gerandoAbordagem ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Gerar abordagem
              </button>
            ) : null}
          </div>

          {erroAbordagem ? (
            <p className="flex items-start gap-1.5 rounded-lg bg-(--color-danger)/10 px-2.5 py-1.5 text-[11px] text-(--color-danger)">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {MENSAGEM_ESTADO[erroAbordagem] || MENSAGEM_ESTADO.erro}
            </p>
          ) : null}

          {abordagem ? (
            <div className="rounded-xl border border-dashed border-(--color-line) p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-(--color-ink-secondary)">Mensagem sugerida (WhatsApp)</p>
              {editandoMensagem ? (
                <textarea
                  value={mensagemEditada}
                  onChange={(e) => setMensagemEditada(e.target.value)}
                  rows={5}
                  className="mt-1.5 w-full rounded-lg border border-(--color-line) bg-(--color-canvas) px-2.5 py-1.5 text-xs text-(--color-ink) outline-none focus:border-(--color-primary)"
                />
              ) : (
                <p className="mt-1.5 whitespace-pre-wrap">{mensagemEditada}</p>
              )}
              {abordagem.versao_curta ? <p className="mt-1.5 text-[11px] text-(--color-ink-secondary)">Versão curta: {abordagem.versao_curta}</p> : null}

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={copiarMensagem} className="flex items-center gap-1 rounded-lg border border-(--color-line) px-2.5 py-1.5 text-[11px] font-semibold text-(--color-ink-secondary) hover:bg-(--color-canvas)">
                  {copiado ? <Check size={11} /> : <Copy size={11} />} {copiado ? 'Copiado' : 'Copiar'}
                </button>
                <button type="button" onClick={() => setEditandoMensagem((v) => !v)} className="flex items-center gap-1 rounded-lg border border-(--color-line) px-2.5 py-1.5 text-[11px] font-semibold text-(--color-ink-secondary) hover:bg-(--color-canvas)">
                  <Pencil size={11} /> {editandoMensagem ? 'Concluir edição' : 'Editar'}
                </button>
                <button
                  type="button"
                  disabled={gerandoAbordagem}
                  onClick={() => gerar()}
                  className="flex items-center gap-1 rounded-lg border border-(--color-line) px-2.5 py-1.5 text-[11px] font-semibold text-(--color-ink-secondary) hover:bg-(--color-canvas) disabled:opacity-60"
                >
                  {gerandoAbordagem ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} Gerar outra versão
                </button>
                <button
                  type="button"
                  onClick={abrirWhatsapp}
                  disabled={!telefoneParaWhatsapp(empresaCandidata?.phone || empresaCandidata?.telefone)}
                  className="ml-auto flex items-center gap-1 rounded-lg bg-(--color-green)/15 px-2.5 py-1.5 text-[11px] font-semibold text-(--color-green) hover:bg-(--color-green)/25 disabled:opacity-50"
                >
                  <Send size={11} /> Abrir WhatsApp
                </button>
              </div>
              {mensagemSalvaId ? <p className="mt-1.5 text-[10px] text-(--color-ink-secondary)">Rascunho salvo no histórico deste lead.</p> : null}
              {!leadId ? <p className="mt-1.5 text-[10px] text-(--color-ink-secondary)">Este candidato ainda não está no CRM — o rascunho só é salvo no histórico depois de "Adicionar ao CRM".</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
