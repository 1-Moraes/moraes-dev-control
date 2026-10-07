import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

// Resolve "/" — a rota raiz nunca tem seu próprio conteúdo; ela só decide
// para onde mandar a pessoa. Sem isto, o React Router não tinha NENHUMA
// rota cadastrada para "/" (App.jsx só tinha "/login" e "/dashboard"), e o
// resultado era tela branca com "No routes matched location /" no console.
//
// Mesmo padrão de loading do ProtectedRoute.jsx: espera a sessão carregar
// antes de decidir, para não mandar alguém já logado de volta pro /login
// só porque a sessão ainda não tinha sido restaurada.
export default function RedirecionamentoRaiz() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--color-canvas)">
        <Loader2 className="animate-spin text-(--color-navy)" size={28} />
      </div>
    )
  }

  return <Navigate to={session ? '/dashboard' : '/login'} replace />
}
