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
  azul: { label: 'Azul', cor: '#2663f2', dot: '#2663f2' },
  amarelo: { label: 'Âmbar', cor: '#b36f00', dot: '#f0a63d' },
  cinza: { label: 'Cinza', cor: '#4a4d54', dot: '#4a4d54' },
}
export const THEME_PADRAO = 'azul'

// Sobrescreve as variáveis de cor do app inteiro — fundo, cartões, bordas,
// sidebar e destaques — conforme a cor escolhida por quem está logado E o
// modo claro/escuro selecionado. Como isso é aplicado via "style" inline
// (para a cor de destaque funcionar), não dá para deixar o modo escuro
// sobrescrever essas mesmas variáveis só via classe CSS — estilo inline
// sempre vence. Por isso cada cor de destaque tem sua própria variante clara
// e escura, escolhida em JavaScript conforme o modo atual.
//
// "azul" é a identidade oficial Moraes.Dev (Fase 0.5, item 2 do
// planejamento — hex exatos fornecidos: Primary #2663F2, Hover #1C4FD6,
// Light #5A8BFF, Blue Background #E5EDFF, Neutros/Paper etc.) e é a cor
// padrão (THEME_PADRAO). "amarelo" e "cinza" são variações herdadas da
// Fase 0 que seguem existindo como opções de tema, mas usam a MESMA base de
// superfície neutra oficial (fundo/cartão/borda/sidebar), só trocando a cor
// de destaque — assim as 3 opções continuam consistentes com a identidade
// visual nova em vez de cada uma ter sua própria paleta de cinzas antiga.
const SUPERFICIE_CLARA = {
  '--color-canvas': '#f7f7f8',
  '--color-surface': '#ffffff',
  '--color-paper': '#f7f5f2',
  '--color-line': '#dadae0',
  '--color-kanban': '#f7f5f2',
  '--color-sidebar-bg': '#ffffff',
  '--color-sidebar-border': '#dadae0',
  '--color-sidebar-text': '#1d1d20',
  '--color-sidebar-text-muted': '#66666f',
}
const SUPERFICIE_ESCURA = {
  '--color-canvas': '#131319',
  '--color-surface': '#1b1b23',
  '--color-paper': '#1b1b23',
  '--color-line': '#2e2e3c',
  '--color-kanban': '#24242f',
  '--color-sidebar-bg': '#1b1b23',
  '--color-sidebar-border': '#2e2e3c',
  '--color-sidebar-text': '#f7f7f8',
  '--color-sidebar-text-muted': '#b6b6c4',
}

export const THEME_PALETTES = {
  azul: {
    claro: {
      ...SUPERFICIE_CLARA,
      '--color-navy': '#2663f2',
      '--color-navy-light': '#1c4fd6',
      '--color-teal': '#2663f2',
      '--color-teal-light': '#5a8bff',
      '--color-sidebar-active-bg': '#e5edff',
      '--color-sidebar-active-text': '#2663f2',
    },
    escuro: {
      ...SUPERFICIE_ESCURA,
      '--color-navy': '#2663f2',
      '--color-navy-light': '#5a8bff',
      '--color-teal': '#2663f2',
      '--color-teal-light': '#5a8bff',
      '--color-sidebar-active-bg': '#24242f',
      '--color-sidebar-active-text': '#5a8bff',
    },
  },
  amarelo: {
    claro: {
      ...SUPERFICIE_CLARA,
      '--color-navy': '#b36f00',
      '--color-navy-light': '#8a5700',
      '--color-teal': '#b36f00',
      '--color-teal-light': '#f0a63d',
      '--color-sidebar-active-bg': '#fdf1e0',
      '--color-sidebar-active-text': '#b36f00',
    },
    escuro: {
      ...SUPERFICIE_ESCURA,
      '--color-navy': '#f0a63d',
      '--color-navy-light': '#ffbf63',
      '--color-teal': '#f0a63d',
      '--color-teal-light': '#ffbf63',
      '--color-sidebar-active-bg': '#3a2a12',
      '--color-sidebar-active-text': '#ffbf63',
    },
  },
  cinza: {
    claro: {
      ...SUPERFICIE_CLARA,
      '--color-navy': '#34363b',
      '--color-navy-light': '#4a4d54',
      '--color-teal': '#4a4d54',
      '--color-teal-light': '#66666f',
      '--color-sidebar-active-bg': '#efece7',
      '--color-sidebar-active-text': '#34363b',
    },
    escuro: {
      ...SUPERFICIE_ESCURA,
      '--color-navy': '#b6b6c4',
      '--color-navy-light': '#f7f7f8',
      '--color-teal': '#b6b6c4',
      '--color-teal-light': '#f7f7f8',
      '--color-sidebar-active-bg': '#24242f',
      '--color-sidebar-active-text': '#f7f7f8',
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
