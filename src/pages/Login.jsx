import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Loader2, LogIn, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { CHAVE_MANTER_CONECTADO } from '../lib/supabaseClient'

// Login real, sem mock e sem bypass — exatamente como pedido na correção
// de autenticação (Fase 0) e reafirmado na Fase 0.5. AuthContext.entrar()
// chama supabase.auth.signInWithPassword de verdade; sem VITE_SUPABASE_URL/
// VITE_SUPABASE_ANON_KEY configurados (.env ainda não existe nesta fase),
// supabaseClient.js já loga um aviso no console e qualquer tentativa de
// login simplesmente falha com o erro real do Supabase (ou da ausência de
// URL) — nunca um usuário falso "passando".
//
// Campo "Usuário ou e-mail" (Fase 0.5, item 13 do planejamento): o rótulo é
// propositalmente genérico porque a forma real de permitir login digitando
// "Chefe" (em vez do e-mail completo) ainda não foi decidida — ela depende
// do Supabase Auth real estar conectado. NÃO existe aqui nenhuma tradução
// client-side de "Chefe" → senha → e-mail real: o valor digitado é enviado
// exatamente como está para supabase.auth.signInWithPassword, que hoje só
// aceita e-mail (então "Chefe" sozinho vai falhar com o erro real do
// Supabase até essa estratégia ser definida — comportamento esperado nesta
// fase, não um bug).
export default function Login() {
  const { session, loading, entrar } = useAuth()
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [manterConectado, setManterConectado] = useState(false)
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

    // Precisa ser gravado ANTES de supabase.auth.signInWithPassword, porque
    // supabaseClient.js decide localStorage vs. sessionStorage lendo esta
    // chave no exato momento em que a sessão é salva (ver storageComEscolha
    // em supabaseClient.js).
    try {
      localStorage.setItem(CHAVE_MANTER_CONECTADO, manterConectado ? '1' : '0')
    } catch {
      // modo privado etc. — ignora; nesse caso a sessão cai no comportamento
      // padrão (sessionStorage, sai ao fechar a guia)
    }

    const { error } = await entrar(usuario.trim(), senha)
    setEntrando(false)
    if (error) {
      setErro('Usuário/e-mail ou senha incorretos, ou o Supabase deste projeto ainda não foi configurado (.env).')
      return
    }
    navigate(location.state?.from?.pathname || '/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--color-canvas) px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          {/* Logo real dentro de um chip escuro — ver nota em
              DashboardLayout.jsx sobre o glow do arquivo fornecido. */}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--color-ink) p-2.5 shadow-md">
            <img src="/brand/logo-moraes-dev.png" alt="Moraes.Dev" className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold text-(--color-ink)">Bem-vindo de volta</h1>
          <p className="mt-1 text-sm text-(--color-ink-secondary)">Entre para continuar no Moraes.Dev Control.</p>
        </div>

        <form
          onSubmit={aoSubmeter}
          className="rounded-2xl border border-(--color-line) bg-(--color-surface) p-6 shadow-sm"
        >
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-(--color-ink-secondary)">Usuário ou e-mail</span>
              <input
                type="text"
                required
                autoComplete="username"
                autoFocus
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2.5 text-sm text-(--color-ink) outline-none transition focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary-bg)"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-(--color-ink-secondary)">Senha</span>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2.5 pr-10 text-sm text-(--color-ink) outline-none transition focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary-bg)"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-(--color-ink-secondary) hover:bg-(--color-canvas)"
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-(--color-ink-secondary)">
              <input
                type="checkbox"
                checked={manterConectado}
                onChange={(e) => setManterConectado(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-(--color-line) text-(--color-primary) focus:ring-(--color-primary-bg)"
              />
              Manter conectado neste dispositivo
            </label>

            {erro && (
              <p role="alert" className="rounded-lg bg-(--color-status-problema-bg) px-3 py-2 text-xs font-medium text-(--color-status-problema)">
                {erro}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={entrando}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-(--color-primary) px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-(--color-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
          >
            {entrando ? <Loader2 className="animate-spin" size={16} /> : <LogIn size={16} />}
            {entrando ? 'Entrando…' : 'Entrar no Control'}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-(--color-ink-secondary)">
          © {new Date().getFullYear()} Moraes.Dev — acesso restrito à equipe interna
        </p>
      </div>
    </div>
  )
}
