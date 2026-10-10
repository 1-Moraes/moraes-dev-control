// autenticacaoServidor — verificação de sessão e autorização para rotas de
// IA (Fase 3B, itens 28/30 do planejamento: "todas as rotas de IA devem
// exigir autenticação", "não confiar em user_id enviado pelo cliente").
// Roda SÓ server-side (api/ia-radar.js). Nunca usa a service_role key —
// de propósito: o acesso é feito com a ANON key + o próprio token da
// sessão do usuário (`Authorization: Bearer <access_token>`), repassado
// como o header de autorização do cliente Supabase. Isso faz o
// PostgREST/Supabase avaliar `auth.uid()` como ESSE usuário em toda
// consulta — ou seja, a autorização e o rate limiting abaixo são impostos
// pelas próprias RLS policies (has_any_role(), ver schema.sql), nunca
// confiados a uma checagem só na aplicação. Não é preciso nenhuma
// SUPABASE_SERVICE_ROLE_KEY para esta rota — só SUPABASE_URL (server-side,
// sem prefixo VITE_; o valor em si não é segredo) e a ANON key, que pode
// reaproveitar VITE_SUPABASE_ANON_KEY (também não é segredo — é a chave
// pública do projeto, protegida pela RLS, não por ser secreta).
import { createClient } from '@supabase/supabase-js'

/**
 * @returns {{url:string, anonKey:string}|null} null quando a configuração server-side do Supabase está ausente
 */
function configuracaoSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  return url && anonKey ? { url, anonKey } : null
}

/**
 * @param {import('http').IncomingHttpHeaders} headers
 * @returns {string|null}
 */
export function extrairBearerToken(headers) {
  const auth = headers?.authorization || headers?.Authorization
  if (!auth || typeof auth !== 'string') return null
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

/**
 * Verifica o token e confere que o usuário é um "membro provisionado" (tem
 * pelo menos um papel em user_roles) — mesma semântica de has_any_role()
 * no banco, mas confirmada aqui ANTES de gastar uma chamada de IA.
 *
 * @param {string|null} accessToken
 * @returns {Promise<{autorizado:true, userId:string, clienteSupabase:Object} | {autorizado:false, motivo:'nao_configurado'|'token_ausente'|'token_invalido'|'sem_permissao'}>}
 */
export async function autenticarEAutorizar(accessToken) {
  const config = configuracaoSupabase()
  if (!config) return { autorizado: false, motivo: 'nao_configurado' }
  if (!accessToken) return { autorizado: false, motivo: 'token_ausente' }

  // Cliente com o token do usuário no header — toda query seguinte corre
  // sob a identidade dele (auth.uid()), nunca com privilégio elevado.
  const clienteSupabase = createClient(config.url, config.anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  })

  const { data: dadosUsuario, error: erroUsuario } = await clienteSupabase.auth.getUser(accessToken)
  if (erroUsuario || !dadosUsuario?.user) return { autorizado: false, motivo: 'token_invalido' }

  const userId = dadosUsuario.user.id
  const { data: papeis, error: erroPapeis } = await clienteSupabase.from('user_roles').select('role_id').eq('profile_id', userId).limit(1)
  if (erroPapeis || !papeis?.length) return { autorizado: false, motivo: 'sem_permissao' }

  return { autorizado: true, userId, clienteSupabase }
}

/**
 * Rate limiting server-side (item 9/30: "não confiar em limites enviados
 * pelo frontend"), apoiado em `ai_logs` — conta quantas chamadas este
 * usuário já fez na última hora. É best-effort (serverless não garante
 * contadores em memória entre invocações; ver limitação documentada no
 * relatório final sobre controle de concorrência), mas o limite em si é
 * imposto no banco, nunca em estado local do processo.
 *
 * @param {Object} clienteSupabase
 * @param {string} userId
 * @param {number} limitePorHora
 * @returns {Promise<{dentroDoLimite:boolean, usoAtual:number}>}
 */
export async function verificarLimiteUso(clienteSupabase, userId, limitePorHora) {
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error } = await clienteSupabase
    .from('ai_logs')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', userId)
    .gte('created_at', umaHoraAtras)

  // Falha ao contar nunca deve travar a feature inteira silenciosamente a
  // favor do usuário (fail-closed seria pior aqui: um erro transitório de
  // rede derrubaria toda a IA) — mas também nunca finge sucesso: loga e
  // segue permitindo, já que o teto é só uma salvaguarda operacional, não
  // uma garantia de billing (nenhuma chamada paga acontece sem credencial
  // configurada, ver AIOrchestrator.js).
  if (error) {
    console.error('ia.rate_limit.erro_ao_contar', error)
    return { dentroDoLimite: true, usoAtual: 0 }
  }

  return { dentroDoLimite: (count || 0) < limitePorHora, usoAtual: count || 0 }
}
