import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fase 1, item 2 do planejamento: substitui a solução temporária da Fase
// 0.5 (client apontando para uma URL fictícia só para não travar). Agora a
// aplicação sabe de forma EXPLÍCITA se o Supabase está configurado ou não —
// nada de fallback silencioso para endpoint falso. Todo código que usa
// `supabase` deve checar `isSupabaseConfigured` antes (ver AuthContext.jsx,
// Login.jsx): quando false, `supabase` é `null` e nenhuma chamada de rede é
// feita.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env (veja .env.example) ou nas variáveis de ambiente do deploy.'
  )
}

// Chave usada pra lembrar a escolha feita na tela de login ("Manter
// conectado"). Fica em localStorage (sobrevive ao fechar a guia) só pra
// guardar essa preferência — a sessão em si é que vai pra localStorage ou
// sessionStorage, dependendo da escolha.
// Renomeada em relação ao original ("ti-chamados-manter-conectado") — essa
// cópia não compartilha nenhuma chave de localStorage com o projeto da GA.
export const CHAVE_MANTER_CONECTADO = 'moraes-dev-control-manter-conectado'

// Storage "roteador": decide, a cada leitura/escrita, se a sessão do
// Supabase deve persistir entre fechamentos de guia (localStorage) ou ser
// descartada assim que a guia fechar (sessionStorage) — sem isso, não tem
// como oferecer o checkbox "Manter conectado" na tela de login.
const storageComEscolha = {
  getItem: (chave) => {
    const manter = localStorage.getItem(CHAVE_MANTER_CONECTADO) === '1'
    return (manter ? localStorage : sessionStorage).getItem(chave)
  },
  setItem: (chave, valor) => {
    const manter = localStorage.getItem(CHAVE_MANTER_CONECTADO) === '1'
    ;(manter ? localStorage : sessionStorage).setItem(chave, valor)
  },
  removeItem: (chave) => {
    localStorage.removeItem(chave)
    sessionStorage.removeItem(chave)
  },
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: storageComEscolha } })
  : null
