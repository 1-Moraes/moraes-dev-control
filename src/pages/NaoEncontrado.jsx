import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

// Página 404 real — antes deste ajuste, qualquer rota sem correspondência
// (incluindo "/") deixava o React Router sem nada para renderizar, e a
// aplicação ficava em branco ("No routes matched location"). Esta rota
// catch-all ("*", ver App.jsx) garante que isso nunca mais aconteça: toda
// URL desconhecida cai aqui em vez de tela branca.
export default function NaoEncontrado() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-(--color-canvas) px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--color-ink) text-white">
        <Compass size={24} />
      </div>
      <h1 className="font-display text-2xl font-bold text-(--color-ink)">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-(--color-ink-secondary)">
        O endereço acessado não existe no Moraes.Dev Control.
      </p>
      <Link
        to="/"
        className="mt-2 rounded-xl bg-(--color-primary) px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-(--color-primary-hover)"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
