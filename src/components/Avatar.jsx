import { iniciais } from '../lib/helpers'

const PALETA = ['#0f2a4a', '#1c4c82', '#34363b', '#8a6600']

function corPara(nome = '') {
  let soma = 0
  for (let i = 0; i < nome.length; i++) soma += nome.charCodeAt(i)
  return PALETA[soma % PALETA.length]
}

export default function Avatar({ nome, size = 32, corOverride, src }) {
  if (src) {
    return (
      <img
        src={src}
        alt={nome}
        title={nome}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: corOverride || corPara(nome || ''),
        fontSize: size * 0.38,
        fontFamily: 'var(--font-display)',
      }}
      title={nome}
    >
      {iniciais(nome)}
    </div>
  )
}
