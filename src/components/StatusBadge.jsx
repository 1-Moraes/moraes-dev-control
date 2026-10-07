// Badge de status — generalizado. A versão original recebia só "status" e
// buscava cor/label num mapa fixo de 5 estágios de chamado (STATUS_CONFIG,
// removido de helpers.js nesta cópia — ver nota lá). Como o Moraes.Dev
// Control ainda não tem pipeline definido no código (são 9 estágios
// propostos: Descoberto → ... → Ganho/Perdido, ver item 10/12 do
// planejamento), este componente agora recebe label/cor diretamente —
// cada tela que precisar dele monta seu próprio mapa de estágio → {label, cor}.
//
// "alerta" substitui o antigo "parado" (chamado sem atualização dentro do
// SLA) — é só um indicador boolean genérico, sem nenhuma lógica embutida de
// cálculo de prazo (isso dependia de campos específicos do chamado).

export default function StatusBadge({ label, cor = '#64748b', corFundo, alerta = false, alertaLabel = 'ATENÇÃO', size = 'md' }) {
  if (!label) return null
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
  const fundo = corFundo || `${cor}1a` // fallback: mesma cor com baixa opacidade (hex + alpha)

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide ${padding}`}
      style={{ backgroundColor: fundo, color: cor }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cor }} />
      {label}
      {alerta && (
        <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-500/20 dark:text-red-400">
          {alertaLabel}
        </span>
      )}
    </span>
  )
}
