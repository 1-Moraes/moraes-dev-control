-- Fase 3A — Inteligência do Radar (WebsiteAnalyzer + Opportunity Score +
-- Buscas Multissegmento).
--
-- DECISÃO CENTRAL (investigação feita antes de escrever esta migration via
-- MCP do Supabase, com o banco real): `lead_analysis` já existe desde a
-- Fase 0, está com 0 linhas, e sua estrutura (sinais jsonb, score_
-- deterministico, score_final, interpretacao_ia reservado pra Fase 3B) já
-- atende integralmente ao que esta fase precisa — por isso NÃO criamos
-- lead_analysis_v2/opportunity_score_v2, só passamos a USAR a tabela que já
-- existia. A única mudança de schema real é:
--   1. novas colunas em `leads` para a confirmação manual de presença
--      digital (precisa ser distinta das colunas automáticas, pra uma nova
--      análise automática NUNCA sobrescrever silenciosamente uma
--      confirmação humana — ver WebsiteAnalyzer.js);
--   2. relaxar as policies de INSERT/UPDATE de `lead_analysis`, hoje
--      restritas a is_admin(), para o mesmo padrão já usado em
--      lead_activities (has_any_role()) — toda a equipe provisionada
--      analisa/pontua leads no dia a dia, não só administradores.
-- DELETE continua restrito a is_admin() em ambas, mantendo o mesmo design
-- deliberado das fases anteriores (perda de histórico de análise/edição é
-- ação sensível, só admin).

-- ----------------------------------------------------------------------------
-- 1) Colunas novas em `leads` — confirmação manual de presença digital
-- ----------------------------------------------------------------------------
-- `website_source_type`/`website_source_detalhe` guardam o resultado da
-- classificação (automática OU manual) — "o QUE foi encontrado".
-- `website_confirmacao`/`website_confirmado_em`/`website_confirmado_por`
-- guardam SE um humano confirmou aquilo — "alguém validou isso?". Separar
-- os dois é o que permite reanalisar automaticamente sem nunca reverter uma
-- confirmação manual (a UI só chama a reclassificação automática quando
-- website_confirmacao = 'nao_confirmado'; ver DrawerAnaliseLead.jsx).
alter table public.leads
  add column website_source_detalhe text,
  add column website_confirmacao text not null default 'nao_confirmado' check (
    website_confirmacao in ('nao_confirmado', 'confirmado_tem', 'confirmado_nao_tem')
  ),
  add column website_confirmado_em timestamptz,
  add column website_confirmado_por uuid references public.profiles (id),
  add column website_url_manual text,
  add column instagram_url text,
  add column facebook_url text;

create index idx_leads_website_confirmacao on public.leads (website_confirmacao);

-- ----------------------------------------------------------------------------
-- 2) Relaxamento de RLS em lead_analysis — mesmo padrão de lead_activities
-- ----------------------------------------------------------------------------
alter policy "Administrador pode criar lead_analysis" on public.lead_analysis
  rename to "Membros provisionados podem criar lead_analysis";
alter policy "Membros provisionados podem criar lead_analysis" on public.lead_analysis
  with check (has_any_role());

alter policy "Administrador pode atualizar lead_analysis" on public.lead_analysis
  rename to "Membros provisionados podem atualizar lead_analysis";
alter policy "Membros provisionados podem atualizar lead_analysis" on public.lead_analysis
  using (has_any_role());

-- "Administrador pode excluir lead_analysis" (DELETE) e "Membros
-- provisionados podem ver lead_analysis" (SELECT) ficam exatamente como
-- estavam — nenhuma mudança nelas nesta migration.
