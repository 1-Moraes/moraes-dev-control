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
-- Campos abaixo da linha "-- Fase 2C" foram adicionados pela migration
-- 0002_fase_2c_crm_leads.sql (CRM / Leads + integração com Radar) — ver
-- esse arquivo para o racional de cada bloco.
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
  updated_at timestamptz not null default now(),

  -- Fase 2C — identidade
  nome_fantasia text,
  categoria text,
  -- origem (provider + id externo) é a chave #1 de deduplicação do Radar,
  -- distinta de lead_source_id (classificação humana em lead_sources).
  origem_provider text,
  origem_source_id text,
  descoberto_em timestamptz not null default now(),

  -- Fase 2C — localização
  endereco text,
  bairro text,
  cidade text,
  estado text,
  latitude double precision,
  longitude double precision,

  -- Fase 2C — contato comercial
  telefone text,
  whatsapp text,
  email text,

  -- Fase 2C — presença digital (website_source_type nunca foi inferido
  -- automaticamente até a Fase 2C — a classificação de fato passou a rodar
  -- na Fase 3A, via WebsiteAnalyzer.js)
  rating numeric,
  quantidade_avaliacoes integer,
  website_source_type text not null default 'unknown' check (
    website_source_type in ('own_domain', 'social_media', 'third_party_platform', 'unknown', 'not_returned')
  ),

  -- Fase 3A — detalhe da classificação (ex.: 'instagram', 'booksy.com') e
  -- confirmação MANUAL de presença digital, em colunas distintas das
  -- automáticas de propósito: uma nova rodada de WebsiteAnalyzer nunca pode
  -- sobrescrever silenciosamente uma confirmação humana (ver
  -- src/lib/radar/WebsiteAnalyzer.js para o racional completo).
  website_source_detalhe text,
  website_confirmacao text not null default 'nao_confirmado' check (
    website_confirmacao in ('nao_confirmado', 'confirmado_tem', 'confirmado_nao_tem')
  ),
  website_confirmado_em timestamptz,
  website_confirmado_por uuid references public.profiles (id),
  website_url_manual text,
  instagram_url text,
  facebook_url text,

  -- Fase 2C — comercial
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  servico_interesse text,
  observacoes text,
  proxima_acao_tipo text check (
    proxima_acao_tipo is null or proxima_acao_tipo in ('whatsapp', 'ligacao', 'follow_up', 'reuniao', 'proposta', 'outro')
  ),
  proxima_acao_data timestamptz,
  proxima_acao_descricao text
);

create index leads_status_idx on public.leads (status);
create index idx_leads_origem on public.leads (origem_provider, origem_source_id);
create index idx_leads_telefone on public.leads (telefone);
create index idx_leads_prioridade on public.leads (prioridade);
create index idx_leads_website_confirmacao on public.leads (website_confirmacao);
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
  interpretacao_ia text, -- Fase 3B: resumo_comercial curto da saída estruturada da IA — nunca substitui score_deterministico
  created_at timestamptz not null default now(),

  -- Fase 3B (Inteligência Artificial Comercial) — saída estruturada
  -- completa da IA (item 13 do planejamento) e rastreabilidade de quem/
  -- qual provider/modelo/versão de prompt gerou esta rodada. Todas
  -- nullable: uma linha continua podendo ser só o score determinístico,
  -- sem nenhuma análise de IA (ver migration 0007).
  interpretacao_estruturada jsonb,
  ia_provider text, -- 'anthropic' | 'openai' | NULL
  ia_model text,
  ia_prompt_versao text,
  usuario_id uuid references public.profiles (id)
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
  updated_at timestamptz not null default now(),
  -- Fase 2D — ver migration 0003_fase_2d_clientes_projetos.sql
  segmento text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo', 'arquivado')),
  origem text, -- 'lead' (conversão) ou 'manual' (cadastro direto) — item 13
  telefone text,
  whatsapp text,
  email text,
  website text,
  endereco text,
  bairro text,
  cidade text,
  estado text,
  cep text,
  responsavel_id uuid references public.profiles (id),
  observacoes text,
  data_inicio_relacionamento date not null default current_date,
  ultimo_contato_em timestamptz
);

create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- Idempotência da conversão Lead → Cliente (item 8): um lead nunca pode
-- originar mais de um cliente.
create unique index clients_lead_id_unico on public.clients (lead_id) where lead_id is not null;
create index idx_clients_status on public.clients (status);
create index idx_clients_responsavel on public.clients (responsavel_id);

alter table public.contacts add constraint contacts_client_id_fkey foreign key (client_id) references public.clients (id) on delete set null;
create index idx_contacts_client_id on public.contacts (client_id);

-- ----------------------------------------------------------------------------
-- PROJETOS
-- ----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nome text not null,
  -- Fase 2D: status inicial passou a ser 'contratado' (criação do projeto
  -- nesta fase). A gestão operacional completa (Kanban, tarefas) é Fase 2E.
  status text not null default 'contratado' check (status in (
    'contratado', 'briefing', 'planejamento', 'design', 'desenvolvimento',
    'homologacao', 'ajustes', 'publicacao', 'finalizado', 'pausado', 'cancelado'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Fase 2D — ver migration 0003_fase_2d_clientes_projetos.sql
  origin_lead_id uuid references public.leads (id),
  service_id uuid references public.services (id),
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  responsavel_id uuid references public.profiles (id),
  data_inicio date,
  prazo_previsto date,
  valor_contratado numeric(12, 2),
  descricao text,
  observacoes text,
  -- Fase 2E — ver migration 0004_fase_2e_gestao_projetos.sql
  briefing jsonb not null default '{}'::jsonb,
  briefing_atualizado_em timestamptz,
  infra_dominio text,
  infra_hospedagem text,
  infra_repositorio text,
  infra_homologacao_url text,
  infra_banco text,
  infra_observacoes text,
  data_finalizacao date,
  motivo_pausa text,
  motivo_cancelamento text
);

create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create index idx_projects_client_id on public.projects (client_id);
create index idx_projects_origin_lead_id on public.projects (origin_lead_id);
create index idx_projects_status on public.projects (status);

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  titulo text not null,
  -- Fase 2E: status migrado para a_fazer/em_andamento/concluida/bloqueada
  -- (era 'pendente' sem CHECK na Fase 0) — ver migration 0004.
  status text not null default 'a_fazer' check (status in ('a_fazer', 'em_andamento', 'concluida', 'bloqueada')),
  responsavel_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Fase 2E — subtarefas (checklist), descrição, prioridade, prazo
  parent_task_id uuid references public.project_tasks (id) on delete cascade,
  descricao text,
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  prazo date,
  concluida_em timestamptz
);

create trigger project_tasks_set_updated_at before update on public.project_tasks
  for each row execute function public.set_updated_at();

create index idx_project_tasks_parent on public.project_tasks (parent_task_id);

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  url text not null,
  nome_arquivo text,
  enviado_por uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  -- Fase 2E
  tipo text not null default 'outro' check (tipo in ('imagem', 'pdf', 'documento', 'logo', 'briefing', 'referencia', 'outro')),
  descricao text
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

create index idx_project_activities_project_id on public.project_activities (project_id);

-- Fase 2E — links do projeto (produção, homologação, Figma, GitHub, Vercel,
-- domínio, hospedagem, outro). Ver migration 0004_fase_2e_gestao_projetos.sql.
create table public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  nome text not null,
  tipo text not null default 'outro' check (tipo in ('producao', 'homologacao', 'figma', 'github', 'vercel', 'dominio', 'hospedagem', 'outro')),
  url text not null,
  observacao text,
  criado_por uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index idx_project_links_project on public.project_links (project_id);

-- Fase 2E — alterações solicitadas (úteis principalmente em
-- Homologação/Ajustes).
create table public.project_change_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  descricao text not null,
  status text not null default 'aberta' check (status in ('aberta', 'em_andamento', 'concluida', 'cancelada')),
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  solicitada_em timestamptz not null default now(),
  concluida_em timestamptz,
  observacoes text,
  criado_por uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_project_change_requests_project on public.project_change_requests (project_id);

-- Fase 2E — registro manual de deploys (sem integração automática com
-- Vercel nesta fase).
create table public.project_deploys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  ambiente text not null default 'homologacao' check (ambiente in ('homologacao', 'producao', 'outro')),
  versao_descricao text,
  url text,
  data_deploy date not null default current_date,
  responsavel_id uuid references public.profiles (id),
  status text not null default 'sucesso' check (status in ('sucesso', 'falha', 'pendente')),
  observacao text,
  created_at timestamptz not null default now()
);

create index idx_project_deploys_project on public.project_deploys (project_id);

-- ----------------------------------------------------------------------------
-- COMERCIAL (propostas, vendas, pagamentos)
-- ----------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  preco_base numeric(12, 2), -- nunca hardcodado no código (item 26/27)
  created_at timestamptz not null default now()
);

-- Fase 2D — catálogo mínimo (seed idempotente via "where not exists", ver
-- migration 0003_fase_2d_clientes_projetos.sql). Sem preço: os valores
-- comerciais da Moraes.Dev variam.
insert into public.services (nome, descricao)
select v.nome, v.descricao
from (values
  ('Landing Page', 'Página única de conversão/captura'),
  ('Site Institucional', 'Site multi-página para apresentar a empresa'),
  ('Redesign', 'Reformulação visual/técnica de um site ou sistema existente'),
  ('Sistema Web', 'Aplicação web sob medida'),
  ('CRM / Sistema Personalizado', 'Sistema de gestão/CRM sob medida'),
  ('Manutenção', 'Suporte e manutenção contínua'),
  ('Outro', 'Serviço fora do catálogo padrão')
) as v(nome, descricao)
where not exists (select 1 from public.services s where s.nome = v.nome);

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

-- Fase 2F — "Acessos rápidos" do Dashboard (ver migration
-- 0005_fase_2f_dashboard_prospeccao.sql). Individual por pessoa, não dado de
-- equipe — por isso RLS é auth.uid() = profile_id em vez de has_any_role().
create table public.user_shortcuts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  nome text not null,
  url text not null,
  icone text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_shortcuts_set_updated_at before update on public.user_shortcuts
  for each row execute function public.set_updated_at();

create index idx_user_shortcuts_profile on public.user_shortcuts (profile_id, ordem);

-- ----------------------------------------------------------------------------
-- RLS — tabelas de negócio (revisado na Fase 1, item 5 do planejamento).
--
-- A versão da Fase 0 ("qualquer authenticated pode ver/criar/editar tudo",
-- using (true)) era dívida técnica CONSCIENTE e documentada, mas o próprio
-- planejamento da Fase 1 pediu revisão antes de ir pra produção — não dá
-- pra levar isso pro primeiro deploy real. A versão abaixo:
--
--   1. Troca "authenticated" (qualquer JWT válido, inclusive uma conta nova
--      que se cadastre sozinha, já que o projeto tem signup aberto por
--      padrão) por "tem pelo menos um papel atribuído em user_roles" —
--      ou seja, só quem já é efetivamente um membro provisionado do time.
--   2. Escrita (insert/update/delete) fica restrita a quem tem o papel
--      Administrador. Hoje só existe um usuário (Chefe/Administrador), então
--      isso já é exatamente correto na prática — e fica pronto pra extensão:
--      quando permissões por área entrarem em uso real na interface (ex.:
--      Comercial só em leads/clientes), cada policy troca "is_admin()" por
--      "is_admin() or has_permission('<slug>')" tabela a tabela, sem
--      precisar redesenhar nada.
--
-- Criar a matriz fina de permissão por área AGORA, sem nenhuma tela usando
-- isso de verdade, seria regra morta e impossível de testar — por isso o
-- corte foi "admin escreve, qualquer membro provisionado lê", não "todo
-- mundo faz tudo".
-- ----------------------------------------------------------------------------

-- SECURITY DEFINER pra poder consultar user_roles/roles sem depender da
-- RLS dessas tabelas (que só libera select, sem write) e sem risco de
-- recursão de policy.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.profile_id = auth.uid()
      and lower(r.nome) = 'administrador'
  );
$$;

-- Tem pelo menos um papel atribuído, qualquer um — usado pra distinguir
-- "conta Supabase Auth existe" de "é membro provisionado do Moraes.Dev
-- Control" (o projeto tem signup aberto por padrão; sem essa checagem,
-- uma conta criada por fora já enxergaria os dados de negócio).
create or replace function public.has_any_role()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles where profile_id = auth.uid()
  );
$$;

-- Preparado para a matriz fina de permissões por área (decisão de design
-- #3 no topo do arquivo) — ainda não usado por nenhuma policy abaixo
-- (nenhuma tela consome permissions ainda), mas a função já existe pronta
-- pra quando entrar em uso real, tabela a tabela.
create or replace function public.has_permission(chave_permissao text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.profile_id = auth.uid()
      and p.chave = chave_permissao
  ) or public.is_admin();
$$;

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
      'create policy "Membros provisionados podem ver %s" on public.%I for select to authenticated using (public.has_any_role())',
      tabela, tabela
    );
    execute format(
      'create policy "Administrador pode criar %s" on public.%I for insert to authenticated with check (public.is_admin())',
      tabela, tabela
    );
    execute format(
      'create policy "Administrador pode atualizar %s" on public.%I for update to authenticated using (public.is_admin())',
      tabela, tabela
    );
    execute format(
      'create policy "Administrador pode excluir %s" on public.%I for delete to authenticated using (public.is_admin())',
      tabela, tabela
    );
  end loop;
end $$;

-- profiles/RBAC também precisam de has_any_role() em vez de "true" puro,
-- pelo mesmo motivo (signup aberto por padrão) — substitui as policies de
-- select criadas lá em cima.
drop policy "Usuários autenticados podem ver perfis" on public.profiles;
create policy "Membros provisionados podem ver perfis" on public.profiles for select to authenticated using (public.has_any_role());

drop policy "Usuários autenticados podem ver RBAC" on public.teams;
drop policy "Usuários autenticados podem ver RBAC" on public.team_members;
drop policy "Usuários autenticados podem ver RBAC" on public.roles;
drop policy "Usuários autenticados podem ver RBAC" on public.permissions;
drop policy "Usuários autenticados podem ver RBAC" on public.role_permissions;
drop policy "Usuários autenticados podem ver RBAC" on public.user_roles;
create policy "Membros provisionados podem ver RBAC" on public.teams for select to authenticated using (public.has_any_role());
create policy "Membros provisionados podem ver RBAC" on public.team_members for select to authenticated using (public.has_any_role());
create policy "Membros provisionados podem ver RBAC" on public.roles for select to authenticated using (public.has_any_role());
create policy "Membros provisionados podem ver RBAC" on public.permissions for select to authenticated using (public.has_any_role());
create policy "Membros provisionados podem ver RBAC" on public.role_permissions for select to authenticated using (public.has_any_role());
create policy "Membros provisionados podem ver RBAC" on public.user_roles for select to authenticated using (public.has_any_role());

-- ----------------------------------------------------------------------------
-- RLS — Fase 2C (CRM / Leads): qualquer membro provisionado pode criar e
-- atualizar leads/notas/atividades, não só Administrador — ver migration
-- 0002_fase_2c_crm_leads.sql para o racional completo. DELETE continua
-- is_admin() (herdado do loop acima, sem alteração: leads não são
-- excluídos pela UI, só movidos para PERDIDO).
-- ----------------------------------------------------------------------------
alter policy "Administrador pode criar leads" on public.leads
  rename to "Membros provisionados podem criar leads";
alter policy "Membros provisionados podem criar leads" on public.leads
  with check (has_any_role());

alter policy "Administrador pode atualizar leads" on public.leads
  rename to "Membros provisionados podem atualizar leads";
alter policy "Membros provisionados podem atualizar leads" on public.leads
  using (has_any_role());

alter policy "Administrador pode criar lead_notes" on public.lead_notes
  rename to "Membros provisionados podem criar lead_notes";
alter policy "Membros provisionados podem criar lead_notes" on public.lead_notes
  with check (has_any_role());

alter policy "Administrador pode atualizar lead_notes" on public.lead_notes
  rename to "Membros provisionados podem atualizar lead_notes";
alter policy "Membros provisionados podem atualizar lead_notes" on public.lead_notes
  using (has_any_role());

alter policy "Administrador pode criar lead_activities" on public.lead_activities
  rename to "Membros provisionados podem criar lead_activities";
alter policy "Membros provisionados podem criar lead_activities" on public.lead_activities
  with check (has_any_role());

alter policy "Administrador pode atualizar lead_activities" on public.lead_activities
  rename to "Membros provisionados podem atualizar lead_activities";
alter policy "Membros provisionados podem atualizar lead_activities" on public.lead_activities
  using (has_any_role());

-- ----------------------------------------------------------------------------
-- RLS — Fase 2D (Clientes/Projetos): mesma lógica da Fase 2C — qualquer
-- membro provisionado pode criar/atualizar clients/contacts/projects e criar
-- project_activities/audit_logs, não só Administrador — ver migration
-- 0003_fase_2d_clientes_projetos.sql. DELETE continua is_admin() em todas;
-- UPDATE de project_activities e audit_logs também continua is_admin()
-- (registros de histórico/auditoria, não editados pela UI).
-- ----------------------------------------------------------------------------
alter policy "Administrador pode criar clients" on public.clients
  rename to "Membros provisionados podem criar clients";
alter policy "Membros provisionados podem criar clients" on public.clients
  with check (has_any_role());

alter policy "Administrador pode atualizar clients" on public.clients
  rename to "Membros provisionados podem atualizar clients";
alter policy "Membros provisionados podem atualizar clients" on public.clients
  using (has_any_role());

alter policy "Administrador pode criar contacts" on public.contacts
  rename to "Membros provisionados podem criar contacts";
alter policy "Membros provisionados podem criar contacts" on public.contacts
  with check (has_any_role());

alter policy "Administrador pode atualizar contacts" on public.contacts
  rename to "Membros provisionados podem atualizar contacts";
alter policy "Membros provisionados podem atualizar contacts" on public.contacts
  using (has_any_role());

alter policy "Administrador pode criar projects" on public.projects
  rename to "Membros provisionados podem criar projects";
alter policy "Membros provisionados podem criar projects" on public.projects
  with check (has_any_role());

alter policy "Administrador pode atualizar projects" on public.projects
  rename to "Membros provisionados podem atualizar projects";
alter policy "Membros provisionados podem atualizar projects" on public.projects
  using (has_any_role());

alter policy "Administrador pode criar project_activities" on public.project_activities
  rename to "Membros provisionados podem criar project_activities";
alter policy "Membros provisionados podem criar project_activities" on public.project_activities
  with check (has_any_role());

alter policy "Administrador pode criar audit_logs" on public.audit_logs
  rename to "Membros provisionados podem criar audit_logs";
alter policy "Membros provisionados podem criar audit_logs" on public.audit_logs
  with check (has_any_role());

-- RLS — Fase 2E (Gestão de Projetos): project_links/project_change_requests/
-- project_deploys são tabelas novas, nascem já com o padrão relaxado
-- (SELECT/INSERT/UPDATE para has_any_role(), DELETE para is_admin()).
-- project_tasks/project_files existiam desde a Fase 0 com INSERT/UPDATE
-- restritos a is_admin() (loop genérico original) — relaxados aqui porque
-- toda a equipe provisionada precisa gerenciar tarefas/arquivos no dia a dia.
alter table public.project_links enable row level security;
alter table public.project_change_requests enable row level security;
alter table public.project_deploys enable row level security;

create policy "Membros provisionados podem ver project_links" on public.project_links for select using (has_any_role());
create policy "Membros provisionados podem criar project_links" on public.project_links for insert with check (has_any_role());
create policy "Membros provisionados podem atualizar project_links" on public.project_links for update using (has_any_role());
create policy "Administrador pode excluir project_links" on public.project_links for delete using (is_admin());

create policy "Membros provisionados podem ver project_change_requests" on public.project_change_requests for select using (has_any_role());
create policy "Membros provisionados podem criar project_change_requests" on public.project_change_requests for insert with check (has_any_role());
create policy "Membros provisionados podem atualizar project_change_requests" on public.project_change_requests for update using (has_any_role());
create policy "Administrador pode excluir project_change_requests" on public.project_change_requests for delete using (is_admin());

create policy "Membros provisionados podem ver project_deploys" on public.project_deploys for select using (has_any_role());
create policy "Membros provisionados podem criar project_deploys" on public.project_deploys for insert with check (has_any_role());
create policy "Membros provisionados podem atualizar project_deploys" on public.project_deploys for update using (has_any_role());
create policy "Administrador pode excluir project_deploys" on public.project_deploys for delete using (is_admin());

alter policy "Administrador pode criar project_tasks" on public.project_tasks
  rename to "Membros provisionados podem criar project_tasks";
alter policy "Membros provisionados podem criar project_tasks" on public.project_tasks
  with check (has_any_role());

alter policy "Administrador pode atualizar project_tasks" on public.project_tasks
  rename to "Membros provisionados podem atualizar project_tasks";
alter policy "Membros provisionados podem atualizar project_tasks" on public.project_tasks
  using (has_any_role());

alter policy "Administrador pode criar project_files" on public.project_files
  rename to "Membros provisionados podem criar project_files";
alter policy "Membros provisionados podem criar project_files" on public.project_files
  with check (has_any_role());

alter policy "Administrador pode atualizar project_files" on public.project_files
  rename to "Membros provisionados podem atualizar project_files";
alter policy "Membros provisionados podem atualizar project_files" on public.project_files
  using (has_any_role());

-- RLS — Fase 2F (Acessos Rápidos do Dashboard): user_shortcuts é dado
-- INDIVIDUAL (não de equipe), então usa auth.uid() = profile_id em vez de
-- has_any_role()/is_admin() — cada pessoa só vê/gerencia os próprios atalhos.
alter table public.user_shortcuts enable row level security;

create policy "Usuário vê os próprios atalhos" on public.user_shortcuts
  for select using (auth.uid() = profile_id);
create policy "Usuário cria os próprios atalhos" on public.user_shortcuts
  for insert with check (auth.uid() = profile_id);
create policy "Usuário atualiza os próprios atalhos" on public.user_shortcuts
  for update using (auth.uid() = profile_id);
create policy "Usuário exclui os próprios atalhos" on public.user_shortcuts
  for delete using (auth.uid() = profile_id);

-- ----------------------------------------------------------------------------
-- RLS — Fase 3A (Inteligência do Radar): lead_analysis estava desde a
-- Fase 0 com INSERT/UPDATE restritos a is_admin() (loop genérico original) —
-- relaxados aqui pro mesmo padrão de lead_activities, porque qualquer
-- membro provisionado roda análises/pontuações no dia a dia. DELETE continua
-- is_admin() (histórico de análise não é excluído pela UI).
-- ----------------------------------------------------------------------------
alter policy "Administrador pode criar lead_analysis" on public.lead_analysis
  rename to "Membros provisionados podem criar lead_analysis";
alter policy "Membros provisionados podem criar lead_analysis" on public.lead_analysis
  with check (has_any_role());

alter policy "Administrador pode atualizar lead_analysis" on public.lead_analysis
  rename to "Membros provisionados podem atualizar lead_analysis";
alter policy "Membros provisionados podem atualizar lead_analysis" on public.lead_analysis
  using (has_any_role());

-- ----------------------------------------------------------------------------
-- RLS — Fase 3B (Inteligência Artificial Comercial): ai_logs tinha INSERT
-- restrito a is_admin() (herdado do loop genérico da Fase 0) — mesma
-- situação que lead_analysis tinha até a 0006. Relaxado aqui pro mesmo
-- padrão (has_any_role()): qualquer membro provisionado roda análises de
-- IA no dia a dia, o log técnico tem que acompanhar. SELECT já era
-- has_any_role() desde a criação (loop genérico). UPDATE/DELETE continuam
-- is_admin() (log técnico não é editado nem excluído pela UI) — ver
-- migration 0007_fase_3b_ia_comercial.sql.
-- ----------------------------------------------------------------------------
alter policy "Administrador pode criar ai_logs" on public.ai_logs
  rename to "Membros provisionados podem criar ai_logs";
alter policy "Membros provisionados podem criar ai_logs" on public.ai_logs
  with check (has_any_role());

-- ----------------------------------------------------------------------------
-- RLS — Fase 3B, migration 0008 (correção de lacuna da 0007): lead_messages
-- tinha INSERT/UPDATE restritos a is_admin() (herdado do loop genérico da
-- Fase 0) — mesma situação que lead_analysis/ai_logs tinham antes de serem
-- corrigidos. Relaxado pro mesmo padrão (has_any_role()): qualquer membro
-- provisionado salva/edita rascunhos de abordagem gerados por IA no dia a
-- dia (salvarAbordagemGerada()/marcarMensagemComoAberta() em
-- src/lib/crm/LeadsService.js). SELECT já era has_any_role() desde a
-- criação. DELETE continua is_admin().
-- ----------------------------------------------------------------------------
alter policy "Administrador pode criar lead_messages" on public.lead_messages
  rename to "Membros provisionados podem criar lead_messages";
alter policy "Membros provisionados podem criar lead_messages" on public.lead_messages
  with check (has_any_role());

alter policy "Administrador pode atualizar lead_messages" on public.lead_messages
  rename to "Membros provisionados podem atualizar lead_messages";
alter policy "Membros provisionados podem atualizar lead_messages" on public.lead_messages
  using (has_any_role());

-- ============================================================================
-- Fim do schema proposto. NÃO EXECUTAR sem: (1) projeto Supabase próprio do
-- Moraes.Dev Control criado, (2) autorização explícita do João.
-- ============================================================================
