import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Loader2, LogIn } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

// Login real, sem mock e sem bypass — exatamente como pedido na correção
// de autenticação. AuthContext.entrar() chama supabase.auth.signInWithPassword
// de verdade; sem VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY configurados
// (.env ainda não existe nesta fase), supabaseClient.js já loga um aviso no
// console e qualquer tentativa de login simplesmente falha com o erro real
// do Supabase (ou da ausência de URL) — nunca um usuário falso "passando".
export default function Login() {
  const { session, loading, entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--color-canvas)">
        <Loader2 className="animate-spin text-(--color-navy)" size={28} />
      </div>
    )
  }

  if (session) {
    const destino = location.state?.from?.pathname || '/dashboard'
    return <Navigate to={destino} replace />
  }

  async function aoSubmeter(e) {
    e.preventDefault()
    setErro('')
    setEntrando(true)
    const { error } = await entrar(email.trim(), senha)
    setEntrando(false)
    if (error) {
      setErro('E-mail ou senha incorretos, ou o Supabase deste projeto ainda não foi configurado (.env).')
      return
    }
    navigate(location.state?.from?.pathname || '/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--color-canvas) px-4">
      <form onSubmit={aoSubmeter} className="w-full max-w-sm rounded-2xl border border-(--color-line) bg-(--color-surface) p-6 shadow-sm">
        <h1 className="font-display text-lg font-bold text-(--color-ink)">Moraes.Dev Control</h1>
        <p className="mt-1 text-xs text-slate-400">Entre com sua conta para continuar.</p>

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-teal)"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Senha</span>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-teal)"
            />
          </label>
          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-500/10">{erro}</p>}
        </div>

        <button
          type="submit"
          disabled={entrando}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-(--color-navy) px-4 py-2.5 text-sm font-semibold text-white hover:bg-(--color-navy-light) disabled:opacity-60"
        >
          {entrando ? <Loader2 className="animate-spin" size={16} /> : <LogIn size={16} />}
          Entrar
        </button>
      </form>
    </div>
  )
}
