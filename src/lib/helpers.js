// Utilitários genéricos herdados do TI-Chamados — adaptados para o
// Moraes.Dev Control.
//
// O QUE FOI REMOVIDO NESTA CÓPIA (acoplado ao domínio "chamados de TI"
// e/ou à GA, sem equivalente ainda neste projeto):
//   - STATUS_FLOW / STATUS_CONFIG (5 estágios do chamado) — o pipeline
//     comercial do Moraes.Dev Control tem 9 estágios diferentes (ver
//     item 10 do planejamento: Descoberto → Qualificado → Contato
//     preparado → Contatado → Respondeu → Reunião → Proposta →
//     Negociação → Ganho/Perdido) e será definido quando o CRM for
//     implementado, não antes.
//   - PRIORIDADE_CONFIG, CATEGORIA_OPTIONS — específicos de chamado
//   - CARGO_OPTIONS — RBAC antigo (3 cargos fixos); o novo RBAC
//     (Administrador/Gestor/Comercial/Desenvolvedor/Designer/Parceiro)
//     ainda não foi implementado nesta fase
//   - ALIASES_FILIAL, TERMOS_PROIBIDOS_FILIAL, normalizarFilial,
//     ehNomeFilialInvalido — normalização das filiais REAIS da GA
//     (Itapevi, Camaçari Move etc.) — não existe conceito de "filial"
//     no Moraes.Dev Control
//   - linkAvaliacaoPublico — link da tela pública de avaliação de
//     chamado, que não foi copiada para este projeto
//   - HORAS_LIMITE_PARADO, isChamadoParado, chamadoTeveAtrasoDeEtapa,
//     aplicarConfiguracoesSistema, SLA_META_PERCENTUAL — conceito de
//     SLA de chamado, acoplado aos campos do chamado (created_at,
//     aceito_em, iniciado_em, respondido_em, finalizado_em)
//   - formatarNumeroChamado — formatação "#00001" específica do número
//     sequencial de chamado
//
// O QUE FOI MANTIDO (genérico, sem acoplamento a chamado/GA):
//   - THEME_OPTIONS / THEME_PADRAO / THEME_PALETTES — sistema de tema
//     de cor + claro/escuro, 100% independente de domínio
//   - formatarDuracao, duracaoEntre, formatarDataHora, iniciais,
//     chaveDia, formatarDataCurta — formatação genérica de data/hora
//   - horasComerciaisEntre (+ dataISO) — cálculo de horas úteis entre
//     duas datas; é só matemática de calendário, sem depender de
//     "chamado" nenhum. Fica disponível pra quando precisar de SLA em
//     projetos/propostas, mas HOJE nada nesta cópia o utiliza —
//     dias úteis/feriados usam o padrão de segurança abaixo até existir
//     uma tela de Configurações equivalente.

export const THEME_OPTIONS = {
  azul: { label: 'Azul', cor: 'var(--color-navy)', dot: '#1c4c82' },
  amarelo: { label: 'Amarelo', cor: 'var(--color-yellow-dark)', dot: '#f2c200' },
  cinza: { label: 'Cinza', cor: 'var(--color-charcoal)', dot: '#34363b' },
}
export const THEME_PADRAO = 'azul'

// Sobrescreve as variáveis de cor do app inteiro — fundo, cartões, bordas e
// destaques — conforme a cor escolhida por quem está logado E o modo
// claro/escuro selecionado. Como isso é aplicado via "style" inline (para a
// cor de destaque funcionar), não dá para deixar o modo escuro sobrescrever
// essas mesmas variáveis só via classe CSS — estilo inline sempre vence.
// Por isso cada cor de destaque tem sua própria variante clara e escura,
// escolhida em JavaScript conforme o modo atual.
export const THEME_PALETTES = {
  azul: {
    claro: {
      '--color-navy': '#0f2a4a',
      '--color-navy-light': '#1c4c82',
      '--color-teal': '#1c4c82',
      '--color-teal-light': '#2a63a3',
      '--color-canvas': '#f5f7fa',
      '--color-surface': '#ffffff',
      '--color-line': '#e2e6ec',
      '--color-kanban': '#eef1f6',
    },
    escuro: {
      '--color-navy': '#1e40af',
      '--color-navy-light': '#3b82f6',
      '--color-teal': '#1e40af',
      '--color-teal-light': '#3b82f6',
      '--color-canvas': '#0d1117',
      '--color-surface': '#161b24',
      '--color-line': '#262c37',
      '--color-kanban': '#1a2029',
    },
  },
  amarelo: {
    claro: {
      '--color-navy': '#8a6600',
      '--color-navy-light': '#b98900',
      '--color-teal': '#b98900',
      '--color-teal-light': '#cf9c00',
      '--color-canvas': '#fbf6e7',
      '--color-surface': '#fffdf6',
      '--color-line': '#ecdfb0',
      '--color-kanban': '#faf0cd',
    },
    escuro: {
      '--color-navy': '#92400e',
      '--color-navy-light': '#f2c200',
      '--color-teal': '#92400e',
      '--color-teal-light': '#f2c200',
      '--color-canvas': '#14110a',
      '--color-surface': '#1e1912',
      '--color-line': '#332b1c',
      '--color-kanban': '#241e14',
    },
  },
  cinza: {
    claro: {
      '--color-navy': '#292a2e',
      '--color-navy-light': '#4a4d54',
      '--color-teal': '#4a4d54',
      '--color-teal-light': '#5c5f66',
      '--color-canvas': '#f0f0ef',
      '--color-surface': '#ffffff',
      '--color-line': '#dcdcda',
      '--color-kanban': '#e8e8e6',
    },
    escuro: {
      '--color-navy': '#3f3f46',
      '--color-navy-light': '#a1a1aa',
      '--color-teal': '#3f3f46',
      '--color-teal-light': '#a1a1aa',
      '--color-canvas': '#111214',
      '--color-surface': '#1a1c1f',
      '--color-line': '#2c2f33',
      '--color-kanban': '#1e2023',
    },
  },
}

export function formatarDuracao(ms) {
  if (ms == null || ms < 0 || Number.isNaN(ms)) return '—'
  const totalMinutos = Math.floor(ms / 60000)
  const dias = Math.floor(totalMinutos / (60 * 24))
  const horas = Math.floor((totalMinutos % (60 * 24)) / 60)
  const minutos = totalMinutos % 60

  if (dias > 0) return `${dias}d ${horas}h`
  if (horas > 0) return `${horas}h ${minutos}min`
  return `${minutos}min`
}

export function duracaoEntre(inicioIso, fimIso) {
  if (!inicioIso) return null
  const inicio = new Date(inicioIso).getTime()
  const fim = fimIso ? new Date(fimIso).getTime() : Date.now()
  return fim - inicio
}

export function formatarDataHora(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function iniciais(nome) {
  if (!nome) return '?'
  const partes = nome.trim().split(/\s+/)
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

// Chave de dia (YYYY-MM-DD) usada para agrupar registros em gráficos de tendência.
export function chaveDia(iso) {
  return new Date(iso).toISOString().slice(0, 10)
}

// Formata uma data (ou chave de dia YYYY-MM-DD) como "dd/mm" para exibição compacta.
export function formatarDataCurta(chaveDiaOuIso) {
  const d = new Date(chaveDiaOuIso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ----------------------------------------------------------------------------
// Horas úteis entre duas datas — utilitário genérico de calendário, sem
// nenhum acoplamento a "chamado". Valores de expediente abaixo são só um
// padrão de segurança; nenhuma tela desta cópia os sobrescreve ainda (isso
// dependeria de uma Configurações equivalente, não implementada nesta fase).
// ----------------------------------------------------------------------------
export const HORA_INICIO_COMERCIAL = 9
export const HORA_FIM_COMERCIAL = 18
export const DIAS_UTEIS = [1, 2, 3, 4, 5] // 0=domingo ... 6=sábado (segunda a sexta)
export const FERIADOS = []

function dataISO(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function horasComerciaisEntre(inicioIso, fimIso) {
  if (!inicioIso || !fimIso) return 0
  const inicio = new Date(inicioIso)
  const fim = new Date(fimIso)
  if (fim <= inicio) return 0

  let totalMs = 0
  let cursor = new Date(inicio)

  while (cursor < fim) {
    const diaSemana = cursor.getDay()
    const inicioComercialDoDia = new Date(cursor)
    inicioComercialDoDia.setHours(HORA_INICIO_COMERCIAL, 0, 0, 0)
    const fimComercialDoDia = new Date(cursor)
    fimComercialDoDia.setHours(HORA_FIM_COMERCIAL, 0, 0, 0)

    if (DIAS_UTEIS.includes(diaSemana) && !FERIADOS.includes(dataISO(cursor))) {
      const janelaInicio = cursor > inicioComercialDoDia ? cursor : inicioComercialDoDia
      const janelaFim = fim < fimComercialDoDia ? fim : fimComercialDoDia
      if (janelaInicio < janelaFim) {
        totalMs += janelaFim - janelaInicio
      }
    }

    const proximoDia = new Date(cursor)
    proximoDia.setDate(proximoDia.getDate() + 1)
    proximoDia.setHours(0, 0, 0, 0)
    cursor = proximoDia
  }

  return totalMs / (1000 * 60 * 60)
}
