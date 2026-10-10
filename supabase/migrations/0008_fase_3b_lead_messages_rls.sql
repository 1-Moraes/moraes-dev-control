-- Fase 3B — correção de uma lacuna da 0007: `lead_messages` realmente não
-- precisava de nenhuma coluna nova (confirmado então e ainda verdade), mas
-- a 0007 não verificou as policies de RLS da tabela — `lead_messages`
-- herdou do loop genérico da Fase 0 o mesmo padrão que `lead_analysis` e
-- `ai_logs` tinham antes de serem corrigidos (0006/0007): INSERT/UPDATE
-- restritos a is_admin(), quando qualquer membro provisionado precisa
-- poder salvar e editar um rascunho de abordagem no dia a dia (item 17 do
-- planejamento da Fase 3B — salvarAbordagemGerada()/
-- marcarMensagemComoAberta() em src/lib/crm/LeadsService.js). SELECT já
-- era has_any_role() desde a criação (loop genérico cobre select pra toda
-- tabela). DELETE continua is_admin() (histórico de mensagens não é
-- excluído pela UI).
--
-- Nenhuma linha existente é apagada ou reescrita; nenhuma coluna nova.

alter policy "Administrador pode criar lead_messages" on public.lead_messages
  rename to "Membros provisionados podem criar lead_messages";
alter policy "Membros provisionados podem criar lead_messages" on public.lead_messages
  with check (has_any_role());

alter policy "Administrador pode atualizar lead_messages" on public.lead_messages
  rename to "Membros provisionados podem atualizar lead_messages";
alter policy "Membros provisionados podem atualizar lead_messages" on public.lead_messages
  using (has_any_role());
