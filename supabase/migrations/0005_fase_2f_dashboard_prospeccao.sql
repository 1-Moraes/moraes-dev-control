-- Fase 2F — Dashboard Operacional + Continuidade da Prospecção.
--
-- Única mudança de schema desta fase (o Dashboard em si e a persistência de
-- busca do Radar/"Já no CRM" são só leitura de tabelas já existentes).
--
-- Antes de criar esta tabela foi confirmado (list_tables / grep em
-- schema.sql) que NÃO existe nenhuma tabela de settings/preferências
-- genérica reutilizável — profiles guarda só cor_tema/layout_menu/
-- pagina_inicial (preferências de interface, não uma lista arbitrária de
-- itens). "Acessos rápidos" é uma lista (nome/URL/ícone/ordem/ativo) por
-- pessoa, então entra como tabela própria, nascendo já com RLS por usuário
-- (cada pessoa só vê/edita as próprias linhas — não é um dado de equipe
-- como clients/leads/projects).
create table public.user_shortcuts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  nome text not null,
  url text not null,
  icone text, -- slug de ícone (lucide-react) escolhido na UI; sem valor =  ícone padrão genérico
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_shortcuts_set_updated_at before update on public.user_shortcuts
  for each row execute function public.set_updated_at();

create index idx_user_shortcuts_profile on public.user_shortcuts (profile_id, ordem);

alter table public.user_shortcuts enable row level security;

-- Cada pessoa só vê/gerencia os próprios atalhos — diferente do padrão
-- has_any_role() usado em clients/leads/projects (dados de equipe); aqui o
-- dado é individual, então a policy é auth.uid() = profile_id em todas as
-- operações.
create policy "Usuário vê os próprios atalhos" on public.user_shortcuts
  for select using (auth.uid() = profile_id);
create policy "Usuário cria os próprios atalhos" on public.user_shortcuts
  for insert with check (auth.uid() = profile_id);
create policy "Usuário atualiza os próprios atalhos" on public.user_shortcuts
  for update using (auth.uid() = profile_id);
create policy "Usuário exclui os próprios atalhos" on public.user_shortcuts
  for delete using (auth.uid() = profile_id);
