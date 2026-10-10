-- Fase 3B — Inteligência Artificial Comercial.
--
-- DECISÃO CENTRAL (investigação no banco real via MCP antes de escrever
-- esta migration, mesmo racional da 0006): `lead_analysis` já reservava
-- `interpretacao_ia text` desde a Fase 0 ("texto da IA interpretando o
-- score — nunca substitui score_deterministico") e `ai_logs` já existia
-- com exatamente as colunas que o item 26 do planejamento pede (provider,
-- model, feature, tokens, custo, duração, sucesso, erro, usuario_id,
-- entidade). NÃO criamos lead_analysis_v2/ai_logs_v2 nem uma tabela nova
-- pra abordagens — `lead_messages` já existia pronta pra isso
-- (canal/rascunho/enviado/criado_por_ia). As únicas mudanças reais:
--
--   1. `lead_analysis` ganha 4 colunas pra guardar a saída ESTRUTURADA da
--      IA (a seção 13 do planejamento pede um JSON com resumo/oportunidade/
--      evidências/hipóteses/serviço/estratégia/abordagem/limitações — isso
--      não cabia só no `interpretacao_ia text` original) e rastreabilidade
--      de quem rodou a análise. `interpretacao_ia` (coluna já existente)
--      passa a guardar o resumo_comercial (texto curto, exatamente o que
--      seu comentário original já previa); o JSON completo vai em
--      `interpretacao_estruturada`, novo. `score_deterministico`/
--      `score_final` continuam idênticos sempre — a IA nunca altera o
--      Opportunity Score (critério de aceite explícito da Fase 3B).
--
--   2. `ai_logs` tinha INSERT restrito a is_admin() (herdado do loop
--      genérico da Fase 0) — mesma situação que `lead_analysis` tinha até
--      a 0006. Relaxado aqui pro mesmo padrão (has_any_role()): qualquer
--      membro provisionado roda análises de IA no dia a dia, o log técnico
--      tem que acompanhar, não só quando um Administrador aciona. SELECT
--      já era has_any_role() desde a criação (loop genérico cobre select
--      pra toda tabela). UPDATE/DELETE continuam is_admin() (log técnico
--      não é editado nem excluído pela UI).
--
-- Nenhuma linha existente é apagada ou reescrita. `lead_messages` não
-- precisa de nenhuma alteração de schema — a Fase 3B só passa a INSERIR
-- nela com `criado_por_ia = true`, exatamente como a tabela já previa.

alter table public.lead_analysis
  add column if not exists interpretacao_estruturada jsonb,
  add column if not exists ia_provider text,
  add column if not exists ia_model text,
  add column if not exists ia_prompt_versao text,
  add column if not exists usuario_id uuid references public.profiles (id);

comment on column public.lead_analysis.interpretacao_ia is
  'Resumo comercial curto gerado pela IA (campo "resumo_comercial" da saída estruturada) — nunca substitui score_deterministico. NULL quando a linha é só o score determinístico sem análise de IA.';
comment on column public.lead_analysis.interpretacao_estruturada is
  'Saída estruturada completa da IA Comercial (Fase 3B, item 13 do planejamento): resumo_comercial, oportunidade_principal, evidencias_utilizadas, hipoteses, servico_recomendado, estrategia, abordagem, limitacoes. NULL quando a linha é só o score determinístico, sem análise de IA.';
comment on column public.lead_analysis.ia_provider is 'anthropic | openai | NULL (quando não houve análise de IA nesta linha)';
comment on column public.lead_analysis.ia_model is 'Identificador do modelo realmente usado (nunca inventado) — NULL quando não houve análise de IA.';
comment on column public.lead_analysis.ia_prompt_versao is 'PROMPT_COMERCIAL_VERSAO (ver src/lib/ai/prompts/promptComercial.js) usada para gerar esta análise — auditoria: qual texto de prompt produziu este resultado.';
comment on column public.lead_analysis.usuario_id is 'Quem acionou esta rodada de análise/pontuação (autor, item 23 do planejamento). NULL em linhas antigas, anteriores a esta coluna.';

alter policy "Administrador pode criar ai_logs" on public.ai_logs
  rename to "Membros provisionados podem criar ai_logs";
alter policy "Membros provisionados podem criar ai_logs" on public.ai_logs
  with check (has_any_role());
