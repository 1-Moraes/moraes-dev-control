-- ============================================================================
-- MORAES.DEV CONTROL — Schema PostgreSQL/Supabase (proposta, Fase 0)
-- ============================================================================
-- ESTE ARQUIVO NÃO FOI EXECUTADO EM NENHUM BANCO. É só o arquivo versionado,
-- criado localmente, aguardando um projeto Supabase próprio do Moraes.Dev
-- Control (ainda não criado) e autorização explícita para rodar.
--
-- NÃO tem nenhuma relação com o schema do TI-Chamados/GA: não foi copiado,
-- não foi "corrigido" a partir dele, e não consultei o banco real da GA pra
-- escrever isto (o diagnóstico da Fase anterior já apontou que o schema.sql
-- versionado do projeto original está desatualizado em relação ao banco
-- real dele — por isso aqui nasce do zero, como fonte de verdade única
-- desde o primeiro dia).
--
-- CONVENÇÕES HERDADAS DO PROJETO ORIGINAL (padrão, não conteúdo):
--   - RLS habilitado em toda tabela, desde a criação
--   - trigger genérica set_updated_at() para colunas updated_at
--   - gen_random_uuid() via extensão pgcrypto
--
-- DECISÕES DE DESIGN QUE SE AFASTAM DA LISTA ORIGINAL DO ITEM 13 (com
-- justificativa — "não crie tabela só porque está na lista"):
--
--   1. "lead_contacts" + "client_contacts" → UNIFICADAS em uma única tabela
--      "contacts", com lead_id e client_id (ambos nullable). Motivo: o
--      item 20 do planejamento pede que, quando um lead virar cliente, os
--      dados NÃO sejam recadastrados — e sim reaproveitados, com
--      rastreabilidade de origem. Duas tabelas separadas forçariam ou
--      duplicar a pessoa (perde rastreabilidade) ou um passo manual de
--      "copiar" contato de uma tabela pra outra (frágil). Uma tabela só,
--      com client_id preenchido no momento da conversão, resolve isso sem
--      duplicar nada e sem lógica extra.
--
--   2. "lead_scores" → NÃO criada como tabela separada de "lead_analysis".
--      Motivo: as duas guardariam, na prática, o mesmo dado (o resultado de
--      uma rodada de pontuação) só que fatiado em dois lugares — redundância
--      sem benefício de normalização real. "lead_analysis" já guarda score
--      determinístico, score final e a interpretação da IA numa linha por
--      rodada de análise; o "score atual" do lead é só a análise mais
--      recente (ORDER BY created_at DESC LIMIT 1), não precisa de tabela.
--
--   3. "permissions" é uma lista plana de slugs de área (ex.: 'prospeccao',
--      'crm', 'projetos:atribuidos'), não uma matriz CRUD por tabela.
--      Motivo: o item 15 pede explicitamente "simples e extensível, não
--      arquitetura corporativa desnecessariamente complexa" — os exemplos
--      dados (Comercial → Prospecção+CRM+Clientes+Comercial) são todos no
--      nível de área/módulo, não de ação (criar/editar/excluir) por tabela.
--
--   4. "profiles" NÃO tem mais uma coluna "cargo" fixa (era enum
--      Analista/Coordenador/Gestor no projeto original). O cargo/função da
--      pessoa agora vem de user_roles → roles. Isso é a mudança central
--      pedida: RBAC real em vez de enum fixo.
--
-- O QUE FOI MANTIDO EXATAMENTE COMO ESTAVA NO ITEM 13 (sem alteração):
--   teams, team_members, roles, role_permissions, user_roles, leads,
--   lead_sources, lead_notes, lead_activities, lead_messages, clients,
--   projects, project_tasks, project_files, project_activities, services,
--   proposals, proposal_items, sales, payments, campaigns, marketing_assets,
--   integrations, automation_rules, ai_logs, audit_logs, notifications
-- ============================================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- IDENTIDADE E RBAC
-- ----------------------------------------------------------------------------

-- Um perfil por usuário autenticado (Supabase Auth). Preferências de
-- interface (tema, layout) reaproveitam exatamente os mesmos campos do
-- projeto original — é código genérico, só o "cargo" fixo saiu daqui.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  avatar_url text,
  ativo boolean not null default true,
  cor_tema text not null default 'azul' check (cor_tema in ('azul', 'amarelo', 'cinza')),
  layout_menu text not null default 'lateral' check (layout_menu in ('lateral', 'superior')),
  pagina_inicial text not null default 'dashboard', -- qual rota abrir ao entrar; mantido por consistência com AuthContext.jsx (atualizarPaginaInicial), sem UI própria nesta fase
  senha_temporaria boolean not null default false, -- true após convite/reset, até a pessoa trocar a senha (ver AuthContext.trocarSenha)
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Equipe (hoje só a própria Moraes.Dev, mas já relacional caso um parceiro
-- externo precise de um "time" separado no futuro — ver cargo "Parceiro"
-- no item 15).
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, profile_id)
);

-- Catálogo de papéis (Administrador, Gestor, Comercial, Desenvolvedor,
-- Designer, Parceiro — exemplos do item 15; a lista real fica editável
-- aqui, sem precisar de migration pra adicionar um papel novo).
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  created_at timestamptz not null default now()
);

-- Slugs de área/módulo — não é uma matriz CRUD, ver decisão de design #3.
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique, -- ex.: 'prospeccao', 'crm', 'clientes', 'projetos:atribuidos', 'configuracoes'
  descricao text
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, role_id)
);

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

create policy "Usuários autenticados podem ver perfis" on public.profiles for select to authenticated using (true);
create policy "Usuário pode atualizar o próprio perfil" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Usuários autenticados podem ver RBAC" on public.teams for select to authenticated using (true);
create policy "Usuários autenticados podem ver RBAC" on public.team_members for select to authenticated using (true);
create policy "Usuários autenticados podem ver RBAC" on public.roles for select to authenticated using (true);
create policy "Usuários autenticados podem ver RBAC" on public.permissions for select to authenticated using (true);
create policy "Usuários autenticados podem ver RBAC" on public.role_permissions for select to authenticated using (true);
create policy "Usuários autenticados podem ver RBAC" on public.user_roles for select to authenticated using (true);
-- Escrita em RBAC (criar papel, atribuir permissão/usuário) é feita só por
-- Vercel Function com service_role (mesmo padrão do api/usuarios.js
-- original) — por isso não há policy de insert/update/delete aqui ainda;
-- entra junto com essa function, numa fase futura.

-- ----------------------------------------------------------------------------
-- PESSOAS (unificação de lead_contacts + client_contacts — decisão #1)
-- ----------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  telefone text,
  cargo_na_empresa text,
  lead_id uuid, -- FK adicionada depois que "leads" existir (ver abaixo)
  client_id uuid, -- FK adicionada depois que "clients" existir (ver abaixo)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger contacts_set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RADAR DE PROSPECÇÃO E CRM / LEADS
-- ----------------------------------------------------------------------------

create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  nome text not null, -- ex.: 'Radar - Google Places', 'Indicação', 'Formulário do site'
  tipo text, -- 'radar' | 'manual' | 'indicacao' | 'inbound'
  created_at timestamptz not null default now()
);

-- Pipeline de 9 estágios do item 10 do planejamento.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  nome_empresa text not null,
  website text,
  status text not null default 'descoberto' check (
    status in ('descoberto', 'qualificado', 'contato_preparado', 'contatado', 'respondeu', 'reuniao', 'proposta', 'negociacao', 'ganho', 'perdido')
  ),
  lead_source_id uuid references public.lead_sources (id),
  responsavel_id uuid references public.profiles (id),
  motivo_perda text, -- preenchido só quando status = 'perdido'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_status_idx on public.leads (status);
create trigger leads_set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.contacts add constraint contacts_lead_id_fkey foreign key (lead_id) references public.leads (id) on delete set null;

-- Uma linha por rodada de análise do Radar (sinais determinísticos → score
-- → interpretação da IA). "sinais" guarda o JSON cru dos sinais técnicos
-- (website encontrado, HTTPS, responsividade, SEO básico etc., ver item 19)
-- pra auditar como o score chegou naquele valor, sem precisar de IA pra
-- reconstituir o raciocínio.
create table public.lead_analysis (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  sinais jsonb not null default '{}'::jsonb,
  score_deterministico smallint not null check (score_deterministico between 0 and 100),
  score_final smallint check (score_final between 0 and 100), -- pode ser igual ao determinístico se a IA não alterar nada
  interpretacao_ia text, -- texto da IA interpretando o score — nunca substitui score_deterministico
  created_at timestamptz not null default now()
);

create index lead_analysis_lead_id_idx on public.lead_analysis (lead_id, created_at desc);

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  autor_id uuid references public.profiles (id),
  texto text not null,
  created_at timestamptz not null default now()
);

-- Timeline estruturada (ligação feita, e-mail enviado, reunião agendada) —
-- diferente de lead_notes (anotação livre) e diferente de audit_logs (log
-- de sistema genérico, não pensado pra exibir como feed de atividade).
create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  autor_id uuid references public.profiles (id),
  tipo text not null, -- 'ligacao' | 'email' | 'reuniao' | 'mudanca_status' | outro
  detalhe text,
  created_at timestamptz not null default now()
);

-- Rascunhos gerados por IA (ex.: mensagem de WhatsApp) — NUNCA enviados
-- automaticamente. Fluxo: IA gera → humano revisa/edita → humano decide
-- enviar (botão "Abrir WhatsApp"), fora deste banco.
create table public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  canal text not null default 'whatsapp',
  rascunho text not null,
  enviado boolean not null default false,
  criado_por_ia boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- CLIENTES
-- ----------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  nome_empresa text not null,
  lead_id uuid references public.leads (id), -- rastreabilidade: de qual lead este cliente veio (item 20)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.contacts add constraint contacts_client_id_fkey foreign key (client_id) references public.clients (id) on delete set null;

-- ----------------------------------------------------------------------------
-- PROJETOS
-- ----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nome text not null,
  status text not null default 'planejamento',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  titulo text not null,
  status text not null default 'pendente',
  responsavel_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger project_tasks_set_updated_at before update on public.project_tasks
  for each row execute function public.set_updated_at();

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  url text not null,
  nome_arquivo text,
  enviado_por uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Feed de atividade do projeto (UI de timeline) — propósito diferente de
-- audit_logs (log de auditoria/compliance genérico, todas as entidades).
create table public.project_activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  autor_id uuid references public.profiles (id),
  descricao text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- COMERCIAL (propostas, vendas, pagamentos)
-- ----------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  preco_base numeric(12, 2),
  created_at timestamptz not null default now()
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id),
  client_id uuid references public.clients (id),
  status text not null default 'rascunho' check (status in ('rascunho', 'enviada', 'aceita', 'recusada')),
  valor_total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger proposals_set_updated_at before update on public.proposals
  for each row execute function public.set_updated_at();

create table public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  service_id uuid references public.services (id),
  descricao text not null,
  quantidade numeric(10, 2) not null default 1,
  valor_unitario numeric(12, 2) not null default 0
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals (id),
  client_id uuid not null references public.clients (id),
  valor_total numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  valor numeric(12, 2) not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'atrasado', 'cancelado')),
  vencimento date,
  pago_em timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- MARKETING
-- ----------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  status text not null default 'planejada',
  created_at timestamptz not null default now()
);

create table public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns (id) on delete cascade,
  url text not null,
  tipo text, -- 'imagem' | 'video' | 'texto' | 'outro'
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- INTEGRAÇÕES E AUTOMAÇÕES (estrutura — nenhuma integração real configurada)
-- ----------------------------------------------------------------------------
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  nome text not null, -- ex.: 'WhatsApp Business', 'E-mail'
  status text not null default 'desconectado' check (status in ('desconectado', 'conectado', 'erro')),
  config jsonb not null default '{}'::jsonb, -- NUNCA secret aqui — só config não-sensível; secrets ficam em env vars
  created_at timestamptz not null default now()
);

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  evento_gatilho text not null, -- ex.: 'lead.status_changed'
  condicao jsonb not null default '{}'::jsonb,
  acao jsonb not null default '{}'::jsonb,
  ativo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- IA — LOGS (item 17: nunca prompt/resposta completos por padrão)
-- ----------------------------------------------------------------------------
create table public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null, -- 'anthropic' | 'openai' | outro
  model text not null,
  feature text not null, -- de onde partiu a chamada, ex.: 'score-lead'
  tokens_entrada integer,
  tokens_saida integer,
  custo_estimado numeric(10, 6),
  duracao_ms integer,
  sucesso boolean not null,
  erro text,
  usuario_id uuid references public.profiles (id),
  entidade_tipo text, -- ex.: 'lead'
  entidade_id uuid,
  -- prompt/resposta completos ficam de fora por padrão — só seriam
  -- adicionados numa coluna própria, nullable, com política de retenção
  -- definida separadamente (item 17: "somente quando houver motivo
  -- específico e política definida").
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- AUDITORIA (item 14 — genérica, cobre qualquer entidade)
-- ----------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.profiles (id),
  acao text not null, -- 'lead.criado' | 'lead.status_alterado' | 'cliente.criado' | ...
  entidade_tipo text not null,
  entidade_id uuid,
  valor_anterior jsonb,
  valor_novo jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);
-- NUNCA registrar aqui: passwords, API keys, tokens, secrets, credenciais.
-- Isso é regra de aplicação (quem grava o log), não é possível impor só
-- pelo schema — reforçar na implementação da função/trigger de auditoria.

-- ----------------------------------------------------------------------------
-- NOTIFICAÇÕES
-- ----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  titulo text not null,
  corpo text,
  lida boolean not null default false,
  entidade_tipo text,
  entidade_id uuid,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- RLS — tabelas de negócio: por ora, "qualquer autenticado vê/edita tudo"
-- (mesmo padrão simples do projeto original). Regras por papel (RBAC real)
-- entram quando user_roles estiver populado e as telas existirem de fato —
-- criar a policy fina agora, sem UI nenhuma pra testá-la, seria regra
-- morta. Isso é dívida técnica CONSCIENTE, documentada nos riscos.
-- ----------------------------------------------------------------------------
do $$
declare
  tabela text;
begin
  for tabela in select unnest(array[
    'contacts', 'lead_sources', 'leads', 'lead_analysis', 'lead_notes', 'lead_activities', 'lead_messages',
    'clients', 'projects', 'project_tasks', 'project_files', 'project_activities',
    'services', 'proposals', 'proposal_items', 'sales', 'payments',
    'campaigns', 'marketing_assets', 'integrations', 'automation_rules',
    'ai_logs', 'audit_logs', 'notifications'
  ])
  loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format(
      'create policy "Autenticados podem ver %s" on public.%I for select to authenticated using (true)',
      tabela, tabela
    );
    execute format(
      'create policy "Autenticados podem criar %s" on public.%I for insert to authenticated with check (true)',
      tabela, tabela
    );
    execute format(
      'create policy "Autenticados podem atualizar %s" on public.%I for update to authenticated using (true)',
      tabela, tabela
    );
  end loop;
end $$;

-- ============================================================================
-- Fim do schema proposto. NÃO EXECUTAR sem: (1) projeto Supabase próprio do
-- Moraes.Dev Control criado, (2) autorização explícita do João.
-- ============================================================================
