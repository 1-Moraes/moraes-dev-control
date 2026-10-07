import { Star } from 'lucide-react'

export default function RatingStars({ nota = 0, tamanho = 20, interativo = false, onChange }) {
  const estrelas = [1, 2, 3, 4, 5]

  return (
    <div className="flex items-center gap-1">
      {estrelas.map((valor) => {
        const preenchida = valor <= nota
        return (
          <button
            key={valor}
            type="button"
            disabled={!interativo}
            onClick={() => interativo && onChange?.(valor)}
            className={interativo ? 'cursor-pointer transition hover:scale-110' : 'cursor-default'}
            aria-label={`${valor} de 5 estrelas`}
          >
            <Star
              size={tamanho}
              strokeWidth={1.8}
              fill={preenchida ? '#f2c200' : 'transparent'}
              className={preenchida ? 'text-(--color-yellow)' : 'text-slate-300'}
            />
          </button>
        )
      })}
    </div>
  )
}
