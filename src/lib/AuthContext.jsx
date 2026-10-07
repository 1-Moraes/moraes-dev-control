import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const idCarregandoRef = useRef(null) // evita duas buscas de perfil em paralelo pro mesmo usuário

  // Movida para ANTES do useEffect que a chama (o original a tinha depois —
  // funcionava por hoisting de function declaration, mas uma versão mais
  // nova do eslint-plugin-react-hooks usada nesta cópia passou a reportar
  // isso como erro de "acessado antes de declarado". Reordenar resolve sem
  // mudar nenhum comportamento.
  async function carregarPerfil(userId) {
    // getSession() (no mount) e onAuthStateChange (no login) costumam disparar
    // quase juntos pro mesmo usuário — sem essa trava, os dois buscam o
    // perfil em paralelo, e existe uma janela onde "loading" pode virar
    // false antes do "profile" estar de fato preenchido.
    if (idCarregandoRef.current === userId) return
    idCarregandoRef.current = userId

    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (!error) {
      // Se a conta foi desativada enquanto a pessoa estava logada em outro
      // dispositivo/aba, força a saída assim que o perfil recarregar.
      if (data && data.ativo === false) {
        await supabase.auth.signOut()
        setProfile(null)
        idCarregandoRef.current = null
        setLoading(false)
        return
      }
      setProfile(data)
    }
    idCarregandoRef.current = null
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session) {
        carregarPerfil(data.session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, novaSessao) => {
      setSession(novaSessao)
      if (novaSessao) {
        carregarPerfil(novaSessao.user.id)
      } else {
        setProfile(null)
        idCarregandoRef.current = null
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function trocarSenha(novaSenha) {
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    if (!error && session) {
      await supabase.from('profiles').update({ senha_temporaria: false }).eq('id', session.user.id)
      setProfile((prev) => (prev ? { ...prev, senha_temporaria: false } : prev))
    }
    return { error }
  }

  async function entrar(email, senha) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    return { error }
  }

  async function sair() {
    await supabase.auth.signOut()
  }

  async function atualizarCorTema(corTema) {
    if (!session) return { error: new Error('Sem sessão ativa') }
    const { error } = await supabase.from('profiles').update({ cor_tema: corTema }).eq('id', session.user.id)
    if (!error) setProfile((prev) => (prev ? { ...prev, cor_tema: corTema } : prev))
    return { error }
  }

  async function atualizarPaginaInicial(paginaInicial) {
    if (!session) return { error: new Error('Sem sessão ativa') }
    const { error } = await supabase.from('profiles').update({ pagina_inicial: paginaInicial }).eq('id', session.user.id)
    if (!error) setProfile((prev) => (prev ? { ...prev, pagina_inicial: paginaInicial } : prev))
    return { error }
  }

  async function atualizarLayoutMenu(layoutMenu) {
    if (!session) return { error: new Error('Sem sessão ativa') }
    const { error } = await supabase.from('profiles').update({ layout_menu: layoutMenu }).eq('id', session.user.id)
    if (!error) setProfile((prev) => (prev ? { ...prev, layout_menu: layoutMenu } : prev))
    return { error }
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, entrar, sair, atualizarCorTema, atualizarPaginaInicial, atualizarLayoutMenu, trocarSenha }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- padrão comum de context file (Provider + hook no mesmo arquivo); já era assim no projeto original
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
