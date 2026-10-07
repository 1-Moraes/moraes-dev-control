import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Bug pré-existente corrigido nesta fase: createClient() lança exceção
// SÍNCRONA ("supabaseUrl is required") quando chamado sem URL — como isso
// acontecia direto no topo deste módulo, sem .env a aplicação INTEIRA
// quebrava com tela branca, nem a tela de login conseguia renderizar (o
// que inviabilizava inclusive a revisão visual desta fase, já que ainda
// não existe nenhum Supabase do Moraes.Dev Control). Isso não é um mock de
// autenticação: os valores abaixo são placeholders obviamente falsos usados
// só para o SDK não quebrar ao instanciar — supabase.auth.signInWithPassword
// continua sendo chamado de verdade e falhando de verdade (erro real de
// rede/DNS para um host que não existe), exatamente como já acontecia
// quando supabaseUrl/supabaseAnonKey vinham vazios.
const SUPABASE_URL_PLACEHOLDER = 'https://supabase-nao-configurado.invalid'
const SUPABASE_ANON_KEY_PLACEHOLDER = 'chave-anon-placeholder-nao-e-credencial-real'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env (veja .env.example).'
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

export const supabase = createClient(
  supabaseUrl || SUPABASE_URL_PLACEHOLDER,
  supabaseAnonKey || SUPABASE_ANON_KEY_PLACEHOLDER,
  { auth: { storage: storageComEscolha } }
)
