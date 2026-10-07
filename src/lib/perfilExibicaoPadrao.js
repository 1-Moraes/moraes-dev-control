// Perfil de EXIBIÇÃO padrão — só para a interface ter algo coerente pra
// mostrar (nome, avatar, cargo de exibição) enquanto não existe nenhum
// Supabase real conectado nesta fase (Fase 0.5, itens 11/12 do
// planejamento). NÃO é autenticação, NÃO é um usuário de verdade, e NÃO
// concede nenhuma permissão.
//
// Regras que isso respeita:
//   - "Chefe" é só um nome de exibição (apelido escolhido pelo usuário),
//     nunca usado para decidir permissão nenhuma. A filtragem de itens
//     "restritos" do menu (ver DashboardLayout.jsx, CARGOS_COM_ACESSO_
//     RESTRITO) compara contra "cargo", não contra "nome" — quando o RBAC
//     real existir, essa checagem vai usar roles/permissions de verdade
//     vindas do banco, nunca uma string de nome.
//   - Nenhuma senha é armazenada aqui nem em nenhum outro lugar do código —
//     este objeto só tem nome, cargo de exibição e caminho de uma imagem
//     estática já commitada no projeto (public/brand/avatar-chefe.jpg).
//   - Isso é usado só como FALLBACK quando "profile" (vindo de verdade do
//     Supabase Auth, ver AuthContext.jsx) ainda é null — ou seja, sem login
//     real funcionando ainda nesta fase, é só o que aparece na prévia visual
//     da interface. Assim que existir Supabase real e a pessoa logar de
//     verdade, "profile" deixa de ser null e passa a valer sobre este
//     fallback em cada campo (ver uso em DashboardLayout.jsx).
export const PERFIL_EXIBICAO_PADRAO = {
  nome: 'Chefe',
  cargo: 'Administrador',
  avatar_url: '/brand/avatar-chefe.jpg',
  cor_tema: 'azul',
  layout_menu: 'lateral',
}
