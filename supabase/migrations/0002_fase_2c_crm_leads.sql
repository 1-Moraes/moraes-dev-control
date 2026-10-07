-- ============================================================================
-- MORAES.DEV CONTROL — Migration 0002 — Fase 2C: CRM / Leads
-- ============================================================================
-- Aplicada diretamente no projeto Supabase real (cjpytibxbyswrcsforpg) via
-- SQL, em 2026-10-07 — ver relatório final da Fase 2C para o motivo de não
-- ter passado pela ferramenta de "migration" formal do MCP (cancelada
-- repetidamente neste ambiente; mesmo efeito, aplicado por execute_sql).
--
-- NOTA SOBRE A CONVENÇÃO: o README desta pasta pede que "0001_schema_inicial.sql"
-- seja uma cópia de ../schema.sql no momento em que ele for executado pela
-- primeira vez. Esse arquivo 0001 nunca chegou a ser criado (lacuna
-- pré-existente a esta fase, não introduzida por ela — ver relatório final,
-- "riscos conhecidos"). Esta migration 0002 segue a convenção a partir de
-- agora; schema.sql foi atualizado em paralelo para refletir o estado atual
-- da tabela leads.
--
-- O que esta migration faz:
--   1) Amplia public.leads com os campos do modelo do lead (identidade,
--      localização, contato comercial, presença digital, próxima ação) —
--      todas as colunas novas são nullable ou têm default seguro.
--   2) Cria índices de apoio à deduplicação (origem, telefone) e aos
--      filtros do Kanban/Tabela (status, prioridade).
--   3) Ajusta RLS: INSERT/UPDATE em leads, lead_notes e lead_activities
--      passam a exigir has_any_role() (qualquer membro provisionado do
--      Moraes.Dev Control), não mais is_admin(). DELETE continua
--      restrito a Administrador (leads não são excluídos pela UI desta
--      fase — só movidos para PERDIDO). Trocado via ALTER POLICY, nunca
--      DROP/CREATE, para preservar o nome e o histórico da policy.
--
-- Reversível: toda ALTER TABLE é ADD COLUMN; para reverter, DROP COLUMN
-- as colunas novas e devolver as policies a is_admin() com ALTER POLICY.

-- 1) IDENTIDADE
alter table public.leads
  add column if not exists nome_fantasia text,
  add column if not exists categoria text,
  -- origem (provider + id externo da fonte) — chave #1 de deduplicação,
  -- distinta de lead_source_id (classificação humana em lead_sources,
  -- ex. "Indicação"/"Site"). Para leads vindos do Radar:
  -- origem_provider = 'google_maps_scraper' (igual a LeadCandidate.source
  -- do Normalizer), origem_source_id = LeadCandidate.sourceId (place_id).
  add column if not exists origem_provider text,
  add column if not exists origem_source_id text,
  add column if not exists descoberto_em timestamptz not null default now();

-- 2) LOCALIZAÇÃO
alter table public.leads
  add column if not exists endereco text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- 3) CONTATO COMERCIAL
alter table public.leads
  add column if not exists telefone text,
  add column if not exists whatsapp text,
  add column if not exists email text;

-- 4) PRESENÇA DIGITAL
alter table public.leads
  add column if not exists rating numeric,
  add column if not exists quantidade_avaliacoes integer,
  add column if not exists website_source_type text not null default 'unknown';

alter table public.leads drop constraint if exists leads_website_source_type_check;
alter table public.leads
  add constraint leads_website_source_type_check
  check (website_source_type in ('own_domain', 'social_media', 'third_party_platform', 'unknown', 'not_returned'));

-- 5) COMERCIAL (prioridade, próxima ação, serviço de interesse, observações)
alter table public.leads
  add column if not exists prioridade text not null default 'media',
  add column if not exists servico_interesse text,
  add column if not exists observacoes text,
  add column if not exists proxima_acao_tipo text,
  add column if not exists proxima_acao_data timestamptz,
  add column if not exists proxima_acao_descricao text;

alter table public.leads drop constraint if exists leads_prioridade_check;
alter table public.leads
  add constraint leads_prioridade_check check (prioridade in ('baixa', 'media', 'alta'));

alter table public.leads drop constraint if exists leads_proxima_acao_tipo_check;
alter table public.leads
  add constraint leads_proxima_acao_tipo_check
  check (proxima_acao_tipo is null or proxima_acao_tipo in ('whatsapp', 'ligacao', 'follow_up', 'reuniao', 'proposta', 'outro'));

-- 5.1) Seed mínimo: lead_sources não tinha nenhuma linha (tabela criada na
-- Fase 0, nunca populada). "Radar de Prospecção" é a origem usada por todo
-- lead criado via [Adicionar ao CRM] no Radar (item 14 do planejamento).
-- INSERT em lead_sources continua restrito a is_admin() (não alterado por
-- esta migration) — por isso o seed entra aqui, uma vez, em vez de ser
-- criado sob demanda pelo cliente (que poderia não ser Administrador).
-- lead_sources.nome não tem constraint UNIQUE — "insert ... select ... where
-- not exists" evita duplicata ao reexecutar a migration (um "on conflict do
-- nothing" sem alvo só protegeria contra colisão de id, que nunca ocorre
-- com um novo gen_random_uuid() a cada execução).
insert into public.lead_sources (nome, tipo)
select 'Radar de Prospecção', 'automatico'
where not exists (select 1 from public.lead_sources where nome = 'Radar de Prospecção');

-- 6) Índices — nenhum é UNIQUE: deduplicação é aviso para revisão manual,
-- nunca bloqueio automático (item 15 do planejamento da Fase 2C).
create index if not exists idx_leads_origem on public.leads (origem_provider, origem_source_id);
create index if not exists idx_leads_telefone on public.leads (telefone);
create index if not exists idx_leads_status on public.leads (status);
create index if not exists idx_leads_prioridade on public.leads (prioridade);

-- 7) RLS — qualquer membro provisionado (has_any_role()) passa a poder
-- criar/atualizar leads, notas e atividades. DELETE continua is_admin().
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
