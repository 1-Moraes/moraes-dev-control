// Timeline horizontal de etapas do projeto — item 10 do planejamento da
// Fase 2E. Puramente visual aqui (a mudança de etapa acontece pelo select
// de status ou pelo Kanban); progresso deriva da posição na sequência
// real, nunca de um percentual manual desconectado (item 11).
import { Check } from 'lucide-react'
import { ETAPAS_PROJETO } from '../../lib/projects/ProjectsService'

export default function TimelineEtapas({ status }) {
  // pausado/cancelado não têm posição própria na sequência — mostramos a
  // timeline "congelada" na última etapa real conhecida (ou na primeira,
  // se o projeto nunca saiu de "contratado"), e o cabeçalho do painel já
  // deixa claro que o projeto está pausado/cancelado.
  const indiceAtual = ETAPAS_PROJETO.findIndex((e) => e.valor === status)
  const indiceEfetivo = indiceAtual >= 0 ? indiceAtual : 0
  const congelado = indiceAtual < 0

  return (
    <div className="flex items-center overflow-x-auto pb-1">
      {ETAPAS_PROJETO.map((etapa, i) => {
        const concluida = i < indiceEfetivo || (congelado && status === 'finalizado')
        const atual = i === indiceEfetivo && !congelado
        const futura = i > indiceEfetivo

        return (
          <div key={etapa.valor} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                  concluida
                    ? 'border-(--color-green-light) bg-(--color-green-light) text-white'
                    : atual
                      ? 'border-(--color-primary) bg-(--color-primary) text-white'
                      : 'border-(--color-line) bg-(--color-surface) text-(--color-ink-secondary)'
                }`}
              >
                {concluida ? <Check size={13} /> : i + 1}
              </div>
              <span
                className={`whitespace-nowrap text-[10px] font-medium ${
                  atual ? 'text-(--color-primary)' : futura ? 'text-(--color-ink-secondary)' : 'text-(--color-ink)'
                }`}
              >
                {etapa.label}
              </span>
            </div>
            {i < ETAPAS_PROJETO.length - 1 ? (
              <div className={`mx-1 h-0.5 w-6 shrink-0 sm:w-10 ${i < indiceEfetivo ? 'bg-(--color-green-light)' : 'bg-(--color-line)'}`} />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
