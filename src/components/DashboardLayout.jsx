// Layout principal do Moraes.Dev Control — adaptado do DashboardLayout.jsx
// original do TI-Chamados (GA Braslog).
//
// O QUE FOI REAPROVEITADO (estrutura, não conteúdo):
//   - esqueleto de sidebar fixa (desktop) + gaveta deslizante (mobile)
//   - layout alternativo "superior" (barra horizontal + menu "Mais")
//   - menu de conta (tema de cor, claro/escuro, página inicial, layout do menu, trocar senha, sair)
//   - toggle de dark mode via classe + variáveis CSS (ver src/index.css e helpers.js)
//
// O QUE FOI REMOVIDO NESTA CÓPIA (específico do domínio "chamados de TI" da GA):
//   - ITENS_NAV antigo (Chamados, Categorias, Filiais, Ativos, Licenças, Acessos
//     Remotos, Contas de E-mail, Base de Conhecimento) → substituído pelo novo
//     menu de 12 itens do Moraes.Dev Control
//   - dependência de useDashboardData() (métricas de chamados, SLA, avisos de
//     "novo chamado", notificações sonoras) — esse contexto não foi copiado;
//     pertence ao domínio de chamados e não tem equivalente ainda no CRM
//   - gauge de "SLA Global" no rodapé da sidebar
//   - toasts de "novo chamado" no canto superior direito
//   - link "Ver formulário público" (era o formulário de abertura de chamado)
//   - logo "/logo-ga.jpg" e textos "Grupo G.A" / "Painel de Chamados" / e-mails
//     ti@ga-braslog.com.br / ti2@ga-braslog.com.br
//   - chave de localStorage "ti_chamados_modo_escuro" → renomeada
//
// IDENTIDADE VISUAL (Fase 0.5): logo oficial aplicada em public/brand/
// logo-moraes-dev.png — arquivo fornecido pelo usuário, usado sem nenhuma
// alteração de geometria/cor/proporção (só redimensionado via CSS, como
// qualquer <img>). É um render de apresentação com glow sobre fundo escuro
// transparente (alpha real nas bordas, confirmado por inspeção de pixel) —
// não é um PNG "limpo" neutro que funcione bem solto sobre branco. Por isso
// aqui ela fica dentro de um "chip" com fundo escuro (--color-ink em modo
// claro / --color-sidebar-bg em modo escuro, que já é escuro), tanto na
// sidebar quanto no login — assim o halo/glow da arte não aparece como uma
// mancha acinzentada sobre a superfície clara do app. Ver relatório final
// desta fase: pendência de uma versão "limpa" (sem glow, fundo
// transparente neutro) para uso solto direto sobre qualquer superfície.
//
// Arquivo servido como estático a partir de public/brand/ (padrão Vite —
// não se importa arquivo de public/ como módulo JS, só se referencia pelo
// caminho absoluto a partir da raiz do site).
const LOGO_MORAES_DEV = '/brand/logo-moraes-dev.png'

// Ajuste visual do header (ver relatório da correção de branding): logo
// horizontal completo oficial (MD + "Moraes.dev"), fundo transparente de
// verdade (alpha real, confirmado por inspeção de pixel), usado como está
// — sem recriar em HTML/texto, sem alterar cores, sem fundo/caixa atrás.
// public/brand/logo-moraes-dev-simbolo.png é um recorte EXATO (mesmos
// pixels, sem distorção/recolorização) só do símbolo "MD" desse mesmo
// arquivo, usado apenas como fallback compacto em telas muito estreitas
// (item 7 do pedido) — nunca substitui o logo horizontal no desktop/tablet.
const LOGO_HEADER_HORIZONTAL = '/brand/logo-moraes-dev-horizontal.png'
const LOGO_HEADER_SIMBOLO = '/brand/logo-moraes-dev-simbolo.png'

// PLACEHOLDER DE RBAC: a filtragem de itens "restritos" abaixo usa um array
// fixo de cargos só pra o menu não ficar sempre visível a qualquer perfil —
// isso NÃO é o RBAC real (teams/roles/permissions) pedido para o projeto.
// Esse placeholder deve ser substituído quando o schema de RBAC for criado
// e conectado a um Supabase de verdade.

import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Radar,
  KanbanSquare,
  Users2,
  FolderKanban,
  Handshake,
  Megaphone,
  Plug,
  Bot,
  Palette,
  Settings,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Check,
  Sun,
  Moon,
  Loader2,
  KeyRound,
  UserCircle2,
  Bell,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { THEME_OPTIONS, THEME_PALETTES, THEME_PADRAO } from '../lib/helpers'
import { PERFIL_EXIBICAO_PADRAO } from '../lib/perfilExibicaoPadrao'
import Avatar from './Avatar'

// Novo menu principal do Moraes.Dev Control (ver item 9 do planejamento).
// Cargos listados em "restrito" são placeholder — ver nota de RBAC acima.
const CARGOS_COM_ACESSO_RESTRITO = ['Administrador']

// (não exportado — o lint de fast-refresh não permite misturar export de
// const/array com export de componente no mesmo arquivo; nada fora deste
// arquivo precisa de ITENS_NAV ainda)
const ITENS_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard/prospeccao', label: 'Prospecção', icon: Radar },
  { to: '/dashboard/crm', label: 'CRM / Leads', icon: KanbanSquare },
  { to: '/dashboard/clientes', label: 'Clientes', icon: Users2 },
  { to: '/dashboard/projetos', label: 'Projetos', icon: FolderKanban },
  { to: '/dashboard/comercial', label: 'Comercial', icon: Handshake },
  { to: '/dashboard/marketing', label: 'Marketing', icon: Megaphone },
  { to: '/dashboard/integracoes', label: 'Integrações', icon: Plug, restrito: true },
  { to: '/dashboard/ia-automacoes', label: 'IA / Automações', icon: Bot, restrito: true },
  { to: '/dashboard/interface', label: 'Interface', icon: Palette },
  { to: '/dashboard/configuracoes', label: 'Configurações', icon: Settings, restrito: true },
  { to: '/dashboard/conta', label: 'Conta', icon: UserCircle2 },
]

// Conteúdo da barra lateral, compartilhado entre a versão fixa (computador)
// e a gaveta deslizante (celular/tablet) — evita manter dois JSX divergentes.
function ConteudoSidebar({ onNavegar, cargo }) {
  const itensVisiveis = ITENS_NAV.filter((item) => !item.restrito || CARGOS_COM_ACESSO_RESTRITO.includes(cargo))
  return (
    <>
      <div>
        <div className="flex items-center gap-2.5 px-1">
          {/* Logo real dentro de um chip escuro (ver nota no topo do arquivo
              sobre o glow do arquivo fornecido) */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--color-ink) p-1 dark:bg-black/40">
            <img src={LOGO_MORAES_DEV} alt="Moraes.Dev" className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="font-display text-sm font-bold leading-tight text-(--color-sidebar-text)">Moraes.Dev Control</p>
            <p className="text-[10px] text-(--color-sidebar-text-muted)">Painel interno</p>
          </div>
        </div>

        <nav className="mt-8 flex flex-col gap-1">
          {itensVisiveis.map(({ to, label, icon: Icon, fim }) => (
            <NavLink
              key={to}
              to={to}
              end={fim}
              onClick={onNavegar}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-(--color-sidebar-active-bg) text-(--color-sidebar-active-text)'
                    : 'text-(--color-sidebar-text-muted) hover:bg-(--color-sidebar-active-bg)/40 hover:text-(--color-sidebar-text)'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="space-y-4">
        <p className="text-center text-[9px] text-(--color-sidebar-text-muted)">
          © {new Date().getFullYear()} Moraes.Dev
          <br />
          Todos os direitos reservados
        </p>
      </div>
    </>
  )
}

// Botão + menu suspenso da conta — reaproveitado no layout lateral e no
// layout superior, pra não manter duas cópias divergentes desse bloco.
function ContaBotao({
  profile,
  escuro,
  setEscuro,
  atualizarCorTema,
  atualizarLayoutMenu,
  setModalSenhaAberto,
  sair,
  menuContaAberto,
  setMenuContaAberto,
}) {
  return (
    <div className="relative">
      <button
        onClick={() => setMenuContaAberto((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-(--color-line) px-1.5 py-1 transition hover:border-slate-300"
      >
        <Avatar nome={profile?.nome} src={profile?.avatar_url} size={28} corOverride={THEME_OPTIONS[profile?.cor_tema || THEME_PADRAO].dot} />
        <div className="hidden pr-0.5 text-left leading-tight sm:block">
          <p className="text-xs font-semibold text-(--color-ink)">{profile?.nome}</p>
          <p className="text-[10px] text-slate-400">{profile?.cargo}</p>
        </div>
        <ChevronDown size={13} className="mr-1 text-slate-400" />
      </button>

      {menuContaAberto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuContaAberto(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-(--color-line) bg-(--color-surface) shadow-lg">
            <div className="flex items-center gap-2.5 border-b border-(--color-line) px-3.5 py-3">
              <Avatar nome={profile?.nome} src={profile?.avatar_url} size={34} corOverride={THEME_OPTIONS[profile?.cor_tema || THEME_PADRAO].dot} />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold text-(--color-ink)">{profile?.nome}</p>
                <p className="text-xs text-slate-400">{profile?.cargo}</p>
              </div>
            </div>

            <div className="p-1.5">
              <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tema do painel</p>
              {Object.entries(THEME_OPTIONS).map(([chave, opt]) => (
                <button
                  key={chave}
                  onClick={() => atualizarCorTema(chave)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-(--color-ink) hover:bg-(--color-canvas)"
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: opt.dot }} />
                  {opt.label}
                  {(profile?.cor_tema || THEME_PADRAO) === chave && (
                    <Check size={13} className="ml-auto text-(--color-teal)" />
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-(--color-line) p-1.5">
              <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Aparência</p>
              <div className="flex gap-1.5 px-2 pb-1">
                <button
                  onClick={() => setEscuro(false)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                    !escuro
                      ? 'border-(--color-teal) bg-(--color-canvas) text-(--color-ink)'
                      : 'border-(--color-line) text-slate-400 hover:bg-(--color-canvas)'
                  }`}
                >
                  <Sun size={13} /> Claro
                </button>
                <button
                  onClick={() => setEscuro(true)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                    escuro
                      ? 'border-(--color-teal) bg-(--color-canvas) text-(--color-ink)'
                      : 'border-(--color-line) text-slate-400 hover:bg-(--color-canvas)'
                  }`}
                >
                  <Moon size={13} /> Escuro
                </button>
              </div>
            </div>

            <div className="border-t border-(--color-line) p-1.5">
              <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Layout do menu</p>
              {[
                { valor: 'lateral', label: 'Menu lateral' },
                { valor: 'superior', label: 'Menu superior' },
              ].map((opcao) => (
                <button
                  key={opcao.valor}
                  onClick={() => atualizarLayoutMenu(opcao.valor)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-(--color-ink) hover:bg-(--color-canvas)"
                >
                  {opcao.label}
                  {(profile?.layout_menu || 'lateral') === opcao.valor && <Check size={13} className="ml-auto text-(--color-teal)" />}
                </button>
              ))}
            </div>

            <div className="border-t border-(--color-line) p-1.5">
              <button
                onClick={() => {
                  setMenuContaAberto(false)
                  setModalSenhaAberto(true)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-(--color-ink) hover:bg-(--color-canvas)"
              >
                <KeyRound size={14} /> Alterar senha
              </button>
              <button
                onClick={sair}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <LogOut size={14} /> Sair
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const CAMINHOS_PRIMARIOS = ['/dashboard', '/dashboard/prospeccao', '/dashboard/crm', '/dashboard/clientes', '/dashboard/projetos']

// Barra de navegação horizontal (layout "superior") — os itens mais usados
// no dia a dia ficam visíveis direto; o resto entra no menu "Mais".
function BarraSuperior({ cargo }) {
  const [maisAberto, setMaisAberto] = useState(false)
  const itensVisiveis = ITENS_NAV.filter((item) => !item.restrito || CARGOS_COM_ACESSO_RESTRITO.includes(cargo))
  const primarios = itensVisiveis.filter((i) => CAMINHOS_PRIMARIOS.includes(i.to))
  const secundarios = itensVisiveis.filter((i) => !CAMINHOS_PRIMARIOS.includes(i.to))

  return (
    <div className="hidden items-center gap-1 border-b border-(--color-line) bg-(--color-surface) px-5 lg:flex print:hidden">
      <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1.5">
        {primarios.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                isActive ? 'bg-(--color-navy) text-white' : 'text-slate-500 hover:bg-(--color-canvas)'
              }`
            }
          >
            <Icon size={14} /> {label}
          </NavLink>
        ))}
      </nav>

      {/* Fica FORA do <nav> com rolagem — um container com overflow-x-auto
          força overflow-y a cortar também (regra do próprio CSS), o que
          escondia esse menu suspenso antes dessa correção (bug já corrigido
          no projeto original, mantido corrigido aqui). */}
      {secundarios.length > 0 && (
        <div className="relative shrink-0 py-1.5">
          <button
            onClick={() => setMaisAberto((v) => !v)}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-(--color-canvas)"
          >
            Mais <ChevronDown size={13} />
          </button>
          {maisAberto && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMaisAberto(false)} />
              <div className="absolute right-0 top-full z-40 mt-1 w-52 overflow-hidden rounded-xl border border-(--color-line) bg-(--color-surface) py-1 shadow-lg">
                {secundarios.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMaisAberto(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 text-xs font-medium ${
                        isActive ? 'bg-(--color-canvas) text-(--color-navy)' : 'text-(--color-ink) hover:bg-(--color-canvas)'
                      }`
                    }
                  >
                    <Icon size={14} /> {label}
                  </NavLink>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout() {
  const { profile: profileReal, sair, atualizarCorTema, atualizarLayoutMenu, trocarSenha } = useAuth()
  // Ver src/lib/perfilExibicaoPadrao.js — só preenche nome/avatar/cargo de
  // EXIBIÇÃO enquanto não existe Supabase real conectado (profile real
  // sempre vence, campo a campo, assim que existir).
  const profile = profileReal ?? PERFIL_EXIBICAO_PADRAO
  const [menuContaAberto, setMenuContaAberto] = useState(false)
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false)
  const [modoLargo, setModoLargo] = useState(false) // pode ser pedido por uma página filha pra abrir mão do teto de largura
  const [escuro, setEscuro] = useState(() => {
    try {
      return localStorage.getItem('moraes_dev_control_modo_escuro') === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('moraes_dev_control_modo_escuro', escuro ? '1' : '0')
    } catch {
      // modo privado etc. — ignora, só não persiste entre recargas
    }
  }, [escuro])

  const paletaTema = THEME_PALETTES[profile?.cor_tema || THEME_PADRAO][escuro ? 'escuro' : 'claro']

  return (
    <div className={`min-h-screen bg-(--color-canvas) ${escuro ? 'dark' : ''}`} style={paletaTema}>
      <div className="flex min-h-screen">
        {/* Sidebar — computador (só no layout "lateral") */}
        {(profile?.layout_menu || 'lateral') === 'lateral' && (
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-(--color-sidebar-border) bg-(--color-sidebar-bg) px-5 py-6 lg:flex print:hidden">
            <ConteudoSidebar cargo={profile?.cargo} />
          </aside>
        )}

        {/* Gaveta de navegação — celular/tablet */}
        {menuMobileAberto && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMenuMobileAberto(false)} />
            <div className="fixed inset-y-0 left-0 flex w-72 flex-col justify-between overflow-y-auto border-r border-(--color-sidebar-border) bg-(--color-sidebar-bg) px-5 py-6 shadow-2xl">
              <button
                onClick={() => setMenuMobileAberto(false)}
                className="absolute right-3 top-3 rounded-full p-1.5 text-(--color-sidebar-text-muted) hover:bg-(--color-sidebar-active-bg) hover:text-(--color-sidebar-text)"
              >
                <X size={18} />
              </button>
              <ConteudoSidebar cargo={profile?.cargo} onNavegar={() => setMenuMobileAberto(false)} />
            </div>
          </div>
        )}

        {/* Coluna principal */}
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-(--color-line) bg-(--color-surface)/95 backdrop-blur print:hidden">
            {/* "Moraes.Dev Control" / "Painel interno" (identidade do PRODUTO)
                já fica na sidebar — aqui no header o foco passa a ser a MARCA,
                o logo horizontal completo, geometricamente centralizado em
                relação ao header inteiro (não aos elementos vizinhos), pra
                nunca ser empurrado pelas ações da direita. `relative` neste
                container + `absolute inset-0` no logo é o que garante isso,
                independente da largura do que existe nos dois lados. */}
            <div className="relative flex items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-5">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setMenuMobileAberto(true)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-(--color-canvas) lg:hidden"
                  title="Abrir menu"
                >
                  <Menu size={20} />
                </button>
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                {/* Desktop/tablet: logo horizontal completo (reduzido um
                    pouco no tablet). Mobile (<sm): só o símbolo "MD", pra
                    nunca colidir com o menu/tema/sino/avatar dos lados. */}
                <img
                  src={LOGO_HEADER_HORIZONTAL}
                  alt="Moraes.Dev"
                  className="hidden h-9 w-auto object-contain sm:block lg:h-11"
                />
                <img src={LOGO_HEADER_SIMBOLO} alt="Moraes.Dev" className="h-7 w-auto object-contain sm:hidden" />
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setEscuro((v) => !v)}
                  className="rounded-lg p-2 text-(--color-ink-secondary) hover:bg-(--color-canvas)"
                  title={escuro ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
                  aria-label={escuro ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
                >
                  {escuro ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                {/* Sino sem contagem/dado nenhum (real ou inventado) — item
                    15 do planejamento da Fase 0.5. Fica inerte até existir
                    um sistema de notificações de verdade. */}
                <button
                  className="rounded-lg p-2 text-(--color-ink-secondary) hover:bg-(--color-canvas)"
                  title="Notificações (em breve)"
                  aria-label="Notificações"
                >
                  <Bell size={18} />
                </button>
                <ContaBotao
                  profile={profile}
                  escuro={escuro}
                  setEscuro={setEscuro}
                  atualizarCorTema={atualizarCorTema}
                  atualizarLayoutMenu={atualizarLayoutMenu}
                  setModalSenhaAberto={setModalSenhaAberto}
                  sair={sair}
                  menuContaAberto={menuContaAberto}
                  setMenuContaAberto={setMenuContaAberto}
                />
              </div>
            </div>
          </header>

          {(profile?.layout_menu || 'lateral') === 'superior' && <BarraSuperior cargo={profile?.cargo} />}

          <main className="flex-1 px-3 py-5 sm:px-5 sm:py-6 print:p-0">
            <div className={`mx-auto print:max-w-none ${modoLargo ? 'max-w-none' : 'max-w-[1400px]'}`}>
              <Outlet context={{ setModoLargo }} />
            </div>
          </main>
        </div>
      </div>

      {modalSenhaAberto && <ModalAlterarSenha trocarSenha={trocarSenha} onFechar={() => setModalSenhaAberto(false)} />}
    </div>
  )
}

function ModalAlterarSenha({ trocarSenha, onFechar }) {
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function salvar() {
    setErro('')
    if (novaSenha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (novaSenha !== confirmacao) {
      setErro('As senhas não são iguais.')
      return
    }
    setSalvando(true)
    const { error } = await trocarSenha(novaSenha)
    setSalvando(false)
    if (error) {
      setErro(error.message)
      return
    }
    setSucesso(true)
    setTimeout(onFechar, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onFechar}>
      <div className="w-full max-w-sm rounded-2xl bg-(--color-surface) p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-base font-bold text-(--color-ink)">Alterar senha</h2>

        {sucesso ? (
          <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            Senha alterada com sucesso!
          </p>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Nova senha</span>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-teal)"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Confirmar nova senha</span>
                <input
                  type="password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-sm text-(--color-ink) outline-none focus:border-(--color-teal)"
                />
              </label>
              {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{erro}</p>}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onFechar} className="rounded-xl border border-(--color-line) px-4 py-2 text-sm font-semibold text-slate-500 hover:border-slate-300">
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex items-center gap-2 rounded-xl bg-(--color-navy) px-4 py-2 text-sm font-semibold text-white hover:bg-(--color-navy-light) disabled:opacity-60"
              >
                {salvando && <Loader2 className="animate-spin" size={14} />}
                Salvar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
