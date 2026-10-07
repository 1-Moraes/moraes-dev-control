-- ============================================================================
-- MORAES.DEV CONTROL — Migration 0003 — Fase 2D: Clientes + Conversão
-- Lead Ganho → Cliente → Projeto
-- ============================================================================
-- Aplicada diretamente no projeto Supabase real (cjpytibxbyswrcsforpg) via
-- execute_sql, em 2026-10-07 — mesmo motivo documentado na migration 0002
-- (a ferramenta de "migration" formal do MCP fica cancelada neste ambiente).
--
-- O que esta migration faz:
--   1) Amplia public.clients com o modelo de cliente do planejamento
--      (segmento, status, origem, contato, localização, responsável,
--      observações, data de início do relacionamento).
--   2) Garante IDEMPOTÊNCIA da conversão Lead → Cliente a nível de banco:
--      índice único parcial em clients.lead_id (um lead nunca pode originar
--      mais de um cliente), além da checagem feita pela aplicação antes de
--      inserir.
--   3) Amplia public.projects com o modelo de projeto (origin_lead_id,
--      service_id, prioridade, responsável, datas, valor contratado,
--      descrição/observações) e os 11 status operacionais previstos
--      (a gestão completa — Kanban de projeto, tarefas — é Fase 2E; aqui só
--      a criação inicial, status inicial = 'contratado').
--   4) Cria índices de apoio às listagens/filtros de Clientes e Projetos.
--   5) Seed idempotente de public.services (catálogo de tipos de serviço,
--      sem preço fixo — os valores comerciais da Moraes.Dev variam e não
--      são hardcoded).
--   6) Ajusta RLS: INSERT/UPDATE em clients, contacts e projects, e INSERT
--      em project_activities e audit_logs, passam a exigir has_any_role()
--      (qualquer membro provisionado), não mais is_admin() — mesma lógica
--      já aplicada a leads/lead_notes/lead_activities na Fase 2C. DELETE
--      continua is_admin() em todas; UPDATE de project_activities e
--      audit_logs também continua is_admin() (são registros de
--      histórico/auditoria, não editados pela UI). Trocado via ALTER
--      POLICY, nunca DROP/CREATE.
--
-- Reversível: toda ALTER TABLE é ADD COLUMN; para reverter, DROP COLUMN as
-- colunas novas, DROP INDEX clients_lead_id_unico e devolver as policies a
-- is_admin() com ALTER POLICY.

-- ----------------------------------------------------------------------------
-- 1) CLIENTES
-- ----------------------------------------------------------------------------
alter table public.clients
  add column if not exists segmento text,
  add column if not exists status text not null default 'ativo',
  -- 'lead' (veio de uma conversão) ou 'manual' (cadastro direto) — item 13
  add column if not exists origem text,
  add column if not exists telefone text,
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists endereco text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists cep text,
  add column if not exists responsavel_id uuid references public.profiles (id),
  add column if not exists observacoes text,
  add column if not exists data_inicio_relacionamento date not null default current_date,
  add column if not exists ultimo_contato_em timestamptz;

alter table public.clients
  add constraint clients_status_check check (status in ('ativo', 'inativo', 'arquivado'));

-- Idempotência da conversão (item 8 do planejamento) a nível de banco.
create unique index if not exists clients_lead_id_unico on public.clients (lead_id) where lead_id is not null;

create index if not exists idx_clients_status on public.clients (status);
create index if not exists idx_clients_responsavel on public.clients (responsavel_id);
create index if not exists idx_contacts_client_id on public.contacts (client_id);

-- ----------------------------------------------------------------------------
-- 2) PROJETOS
-- ----------------------------------------------------------------------------
alter table public.projects
  add column if not exists origin_lead_id uuid references public.leads (id),
  add column if not exists service_id uuid references public.services (id),
  add column if not exists prioridade text not null default 'media',
  add column if not exists responsavel_id uuid references public.profiles (id),
  add column if not exists data_inicio date,
  add column if not exists prazo_previsto date,
  add column if not exists valor_contratado numeric(12, 2),
  add column if not exists descricao text,
  add column if not exists observacoes text;

-- Projeto criado nesta fase começa em CONTRATADO (item 18); o default
-- anterior ('planejamento', da Fase 0) segue válido para o check abaixo.
alter table public.projects alter column status set default 'contratado';

alter table public.projects
  add constraint projects_status_check check (status in (
    'contratado', 'briefing', 'planejamento', 'design', 'desenvolvimento',
    'homologacao', 'ajustes', 'publicacao', 'finalizado', 'pausado', 'cancelado'
  ));

alter table public.projects
  add constraint projects_prioridade_check check (prioridade in ('baixa', 'media', 'alta'));

create index if not exists idx_projects_client_id on public.projects (client_id);
create index if not exists idx_projects_origin_lead_id on public.projects (origin_lead_id);
create index if not exists idx_projects_status on public.projects (status);
create index if not exists idx_project_activities_project_id on public.project_activities (project_id);

-- ----------------------------------------------------------------------------
-- 3) CATÁLOGO DE SERVIÇOS (seed idempotente, sem preço fixo — item 26/27)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 4) RLS — Fase 2D (Clientes/Projetos): mesma lógica da Fase 2C.
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
