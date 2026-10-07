// Hook compartilhado pelos 8 componentes de seção do Dashboard (Fase 2F).
//
// Cada seção busca os PRÓPRIOS dados e trata o PRÓPRIO erro — é essa
// independência que garante a resiliência exigida no planejamento ("uma
// seção falhando não deve derrubar o Dashboard inteiro"). `refreshKey` é só
// um número que o Dashboard.jsx incrementa (botão "Atualizar" ou volta à
// aba) para refazer a busca sem precisar de polling.
import { useEffect, useState } from 'react'

export function useSecaoDados(buscar, refreshKey) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let vivo = true
    // Mesmo padrão de Crm.jsx/AuthContext.jsx: nenhum setState roda de
    // forma síncrona no corpo do effect — a própria troca para
    // "carregando" só acontece dentro do primeiro .then() da cadeia,
    // depois de buscar() já ter sido chamada.
    Promise.resolve()
      .then(() => {
        if (!vivo) return undefined
        setCarregando(true)
        setErro(null)
        return buscar()
      })
      .then((res) => {
        if (vivo && res !== undefined) setDados(res)
      })
      .catch((e) => {
        if (vivo) setErro(e?.message || 'Não foi possível carregar esta seção.')
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `buscar` é recriado a cada render de propósito (closure leve); só refreshKey deve disparar a refetch
  }, [refreshKey])

  return { dados, carregando, erro }
}
