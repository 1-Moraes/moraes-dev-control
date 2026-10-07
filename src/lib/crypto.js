// Criptografia de senhas do lado do navegador — a senha-mestra NUNCA sai da
// memória local e NUNCA é salva em lugar nenhum (nem banco, nem localStorage).
// Usa só a Web Crypto API, já embutida em qualquer navegador moderno — sem
// biblioteca nova, sem custo, mantendo o mesmo princípio do resto do projeto.
//
// Como funciona:
// 1. A senha-mestra vira uma chave de verdade (AES-256) via PBKDF2, um
//    algoritmo pensado pra isso — não dá pra "voltar" da chave pra senha.
// 2. Cada texto sensível é cifrado com AES-GCM, que já embute a proteção
//    contra adulteração (se alguém mexer no texto cifrado, a decifra falha).
// 3. O "sal" (salt) do PBKDF2 não é segredo — só existe pra dificultar ataques
//    de força bruta com tabelas prontas. Pode ficar fixo no código.

// Salt próprio do Moraes.Dev Control — NÃO é o mesmo salt do projeto
// original (era 'ti-chamados-ga-braslog-cofre-v1'). Trocar o salt também
// significa que nenhum blob cifrado pelo cofre antigo pode ser decifrado
// aqui, o que é o comportamento correto para dois projetos independentes.
const SAL_FIXO = new TextEncoder().encode('moraes-dev-control-cofre-v1')
const ITERACOES_PBKDF2 = 210000 // recomendação atual da OWASP para PBKDF2-SHA256
const TEXTO_VERIFICACAO = 'moraes-dev-control-verificacao-ok'

// Deriva a chave AES-256 a partir da senha-mestra digitada. A mesma senha
// sempre gera a mesma chave (determinístico), então duas pessoas digitando a
// mesma senha-mestra conseguem decifrar os dados uma da outra.
export async function derivarChave(senhaMestra) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(senhaMestra),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SAL_FIXO, iterations: ITERACOES_PBKDF2, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// Cifra um texto com a chave derivada. Retorna uma string base64 (IV +
// texto cifrado juntos), pronta para salvar numa coluna de texto no banco.
export async function cifrar(texto, chave) {
  if (!texto) return ''
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const dados = new TextEncoder().encode(texto)
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, dados)
  const combinado = new Uint8Array(iv.length + cifrado.byteLength)
  combinado.set(iv, 0)
  combinado.set(new Uint8Array(cifrado), iv.length)
  return btoa(String.fromCharCode(...combinado))
}

// Decifra uma string gerada por cifrar(). Lança erro se a chave (senha-mestra)
// estiver errada ou o dado estiver corrompido — quem chama deve tratar isso.
export async function decifrar(textoCifrado, chave) {
  if (!textoCifrado) return ''
  const combinado = Uint8Array.from(atob(textoCifrado), (c) => c.charCodeAt(0))
  const iv = combinado.slice(0, 12)
  const dados = combinado.slice(12)
  const decifrado = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, chave, dados)
  return new TextDecoder().decode(decifrado)
}

// Gera o "blob de verificação": cifra um texto conhecido com a chave da
// senha-mestra recém-definida. Guardado uma única vez no banco.
export async function gerarVerificacao(chave) {
  return cifrar(TEXTO_VERIFICACAO, chave)
}

// Confere se a senha-mestra digitada é a certa, tentando decifrar o blob de
// verificação salvo no banco e comparando com o texto conhecido.
export async function conferirVerificacao(blobVerificacao, chave) {
  try {
    const resultado = await decifrar(blobVerificacao, chave)
    return resultado === TEXTO_VERIFICACAO
  } catch {
    return false
  }
}

// Versões binárias de cifrar/decifrar — mesmo esquema (AES-GCM, mesma
// chave), mas pra dados de arquivo (ArrayBuffer) em vez de texto. Usadas
// pra anexar QUALQUER tipo de arquivo numa categoria protegida da Base de
// Conhecimento: em vez de bloquear tipo sensível (.pfx, .exe...), cifra os
// bytes antes de subir — o link público do Storage só serve dado ilegível
// sem a senha-mestra.
export async function cifrarBinario(arrayBuffer, chave) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, arrayBuffer)
  const combinado = new Uint8Array(iv.length + cifrado.byteLength)
  combinado.set(iv, 0)
  combinado.set(new Uint8Array(cifrado), iv.length)
  return combinado
}

export async function decifrarBinario(arrayBuffer, chave) {
  const bytes = new Uint8Array(arrayBuffer)
  const iv = bytes.slice(0, 12)
  const dados = bytes.slice(12)
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, chave, dados)
}
