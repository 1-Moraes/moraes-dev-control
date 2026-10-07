// Página placeholder genérica — todas as 12 seções do menu novo usam este
// componente nesta fase (ver item 9 do planejamento: "nesta fase as páginas
// podem inicialmente ser placeholders bem estruturados").
//
// Inspirado no padrão EmConstrucao.jsx do projeto original (mesma ideia:
// título + mensagem), mas escrito do zero — EmConstrucao.jsx não estava na
// lista de arquivos aprovados para cópia.

export default function Placeholder({ titulo, descricao }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-(--color-line) bg-(--color-surface) p-10 text-center">
      <h1 className="font-display text-xl font-bold text-(--color-ink)">{titulo}</h1>
      <p className="max-w-md text-sm text-slate-400">
        {descricao || 'Esta seção ainda não foi implementada. A rota, o menu e a estrutura de acesso já estão prontos — o conteúdo entra em uma fase futura, com autorização.'}
      </p>
    </div>
  )
}
