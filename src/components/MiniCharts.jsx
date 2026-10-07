import { useEffect, useState } from 'react'

// Gráficos leves em SVG puro — sem dependência nova (mantém o princípio de
// zero custo/zero complexidade extra do projeto).
//
// IMPORTANTE: cores que usam var(--...) vão sempre dentro de "style", nunca
// como atributo solto (ex.: fill="var(--x)"). Atributo de apresentação SVG
// nem sempre reage a variáveis CSS mudando depois (ex.: ao trocar de tema),
// enquanto "style" sempre resolve var() corretamente e ao vivo.
//
// Animação de entrada: a linha "desenha" da esquerda pra direita (clip-path),
// os pontos aparecem em sequência (fade + escala, com atraso crescente), e a
// rosca/gauge "enchem" suavemente (transição de stroke-dashoffset em duas
// fases: primeiro pinta escondido, depois anima até o valor real).
//
// Tooltip: cada ponto/fatia tem um <title> nativo do SVG, que o navegador
// mostra ao passar o mouse, com o valor exato — sem precisar rastrear
// posição do mouse manualmente.

export function GraficoLinha({ dados, altura = 150, corLinha = 'var(--color-navy-light)', unidadeLabel = 'registro(s)' }) {
  if (!dados || dados.length === 0) return null
  const maior = Math.max(1, ...dados.map((d) => d.total))
  const passoX = 56
  const largura = Math.max(240, (dados.length - 1) * passoX + 48)
  const topoMargem = 24
  const baseY = altura - 28

  const pontos = dados.map((d, i) => {
    const x = 24 + i * passoX
    const y = baseY - (d.total / maior) * (baseY - topoMargem)
    return { x, y, total: d.total, chave: d.chave }
  })

  const linhaPath = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linhaPath} L ${pontos[pontos.length - 1].x} ${baseY} L ${pontos[0].x} ${baseY} Z`

  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} width="100%" height={altura} preserveAspectRatio="none">
      <g style={{ animation: 'ti-chart-wipe-in 0.9s cubic-bezier(0.4,0,0.2,1) both' }}>
        <path d={areaPath} style={{ fill: corLinha }} opacity="0.08" />
        <path d={linhaPath} fill="none" style={{ stroke: corLinha }} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </g>
      {pontos.map((p, i) => (
        <g
          key={i}
          style={{
            animation: `ti-chart-fade-in 0.35s ease ${0.5 + i * 0.025}s both`,
            transformOrigin: `${p.x}px ${p.y}px`,
          }}
        >
          <circle cx={p.x} cy={p.y} r="3.5" style={{ fill: corLinha }}>
            <title>{`${p.chave ? formatarChaveTooltip(p.chave) : ''}: ${p.total} ${unidadeLabel}`}</title>
          </circle>
          {p.total > 0 && (
            <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="10" fontWeight="700" style={{ fill: 'var(--color-ink)' }}>
              {p.total}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

// Formata a chave de dia (YYYY-MM-DD) como dd/mm para o tooltip do ponto.
function formatarChaveTooltip(chave) {
  try {
    return new Date(chave).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  } catch {
    return chave
  }
}

const CORES_ROSCA = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']

export function GraficoRosca({ dados, total, tamanho = 140, espessura = 18, unidadeLabel = 'registro(s)' }) {
  const raio = (tamanho - espessura) / 2
  const circunferencia = 2 * Math.PI * raio

  // Só anima depois de montar: no primeiro render, cada fatia começa com o
  // traço "todo escondido" (dashoffset = circunferência inteira); assim que
  // "montado" vira true, o valor real entra em cena e a transição CSS
  // (definida no style de cada <circle>) anima suavemente até lá.
  const [montado, setMontado] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMontado(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Calcula o comprimento e o deslocamento de cada fatia sem variável
  // mutável: cada passo do reduce recebe o "acumulado até aqui" do passo
  // anterior e devolve o próximo, sem reatribuir nada durante a renderização.
  const { segmentos } = dados.reduce(
    (estado, d) => {
      const fracao = total ? d.total / total : 0
      const comprimento = fracao * circunferencia
      const offset = circunferencia - estado.acumulado
      return {
        acumulado: estado.acumulado + comprimento,
        segmentos: [...estado.segmentos, { ...d, comprimento, offset }],
      }
    },
    { acumulado: 0, segmentos: [] }
  )

  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
      <circle cx={tamanho / 2} cy={tamanho / 2} r={raio} fill="none" style={{ stroke: 'var(--color-kanban)' }} strokeWidth={espessura} />
      {segmentos.map((seg, i) => {
        if (seg.comprimento <= 0) return null
        const percentual = total ? Math.round((seg.total / total) * 100) : 0
        return (
          <circle
            key={seg.rotulo ?? i}
            cx={tamanho / 2}
            cy={tamanho / 2}
            r={raio}
            fill="none"
            style={{
              stroke: CORES_ROSCA[i % CORES_ROSCA.length],
              transition: `stroke-dashoffset 0.8s ${0.15 + i * 0.06}s cubic-bezier(0.4,0,0.2,1)`,
            }}
            strokeWidth={espessura}
            strokeDasharray={`${seg.comprimento} ${circunferencia - seg.comprimento}`}
            strokeDashoffset={montado ? seg.offset : circunferencia}
            transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
          >
            <title>{`${seg.rotulo ?? ''}: ${seg.total} ${unidadeLabel} (${percentual}%)`}</title>
          </circle>
        )
      })}
      <text x="50%" y="47%" textAnchor="middle" fontSize="24" fontWeight="800" style={{ fill: 'var(--color-ink)' }}>
        {total}
      </text>
      <text x="50%" y="63%" textAnchor="middle" fontSize="10" fill="#94a3b8">
        total
      </text>
    </svg>
  )
}

// Gauge circular simples e genérico (no projeto original era usado para o
// indicador de "SLA Global" da sidebar — removido desta cópia junto com o
// resto do contexto de chamados; o componente em si fica disponível para
// qualquer métrica percentual futura, como taxa de conversão do funil).
export function GaugeCircular({ percentual, tamanho = 88, espessura = 10, cor = 'var(--color-teal)', tooltipLabel = 'Percentual' }) {
  const raio = (tamanho - espessura) / 2
  const circunferencia = 2 * Math.PI * raio
  const valor = percentual == null ? 0 : Math.max(0, Math.min(100, percentual))
  const comprimentoFinal = (valor / 100) * circunferencia

  // Mesma técnica de duas fases da rosca: começa em 0% e anima até o valor real.
  const [montado, setMontado] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMontado(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const comprimento = montado ? comprimentoFinal : 0

  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
      <circle cx={tamanho / 2} cy={tamanho / 2} r={raio} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={espessura} />
      <circle
        cx={tamanho / 2}
        cy={tamanho / 2}
        r={raio}
        fill="none"
        style={{ stroke: cor, transition: 'stroke-dasharray 1s 0.15s cubic-bezier(0.4,0,0.2,1)' }}
        strokeWidth={espessura}
        strokeDasharray={`${comprimento} ${circunferencia - comprimento}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
      >
        <title>{percentual == null ? 'Sem dados ainda' : `${tooltipLabel}: ${percentual}%`}</title>
      </circle>
      <text x="50%" y="53%" textAnchor="middle" fontSize="18" fontWeight="800" fill="white">
        {percentual == null ? '—' : `${percentual}%`}
      </text>
    </svg>
  )
}
