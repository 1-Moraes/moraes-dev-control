-- Fase 2E — Gestão completa de Projetos (central operacional).
--
-- Reaproveita integralmente o que já existia (projects, project_tasks,
-- project_files, services, profiles, audit_logs). Nenhuma tabela
-- duplicada foi criada. Toda alteração é ADITIVA (ADD COLUMN / CREATE
-- TABLE) — projects e clients já tinham dados reais no momento desta
-- migration e precisam ser preservados integralmente.
--
-- Novidades:
--   - projects: briefing (jsonb genérico, reaproveitável por tipo de
--     serviço no futuro sem precisar de engine dinâmica agora) +
--     metadados de infraestrutura (somente não sensíveis: domínio,
--     hospedagem, repositório, URL de homologação, banco — nunca
--     senha/token/secret) + motivo de pausa/cancelamento + data de
--     finalização.
--   - project_tasks: suporte a subtarefas (parent_task_id), descrição,
--     prioridade, prazo, conclusão. Status migrado de 'pendente' (sem
--     CHECK) para a_fazer/em_andamento/concluida/bloqueada.
--   - project_files: tipo (categoria do arquivo) + descrição.
--   - project_links (nova): links do projeto (produção, homologação,
--     Figma, GitHub, Vercel, domínio, hospedagem, outro).
--   - project_change_requests (nova): alterações solicitadas durante
--     homologação/ajustes.
--   - project_deploys (nova): registro manual de deploys (sem
--     integração automática com Vercel nesta fase).
--
-- RLS: SELECT/INSERT/UPDATE para qualquer membro provisionado
-- (has_any_role()), DELETE restrito a administrador (is_admin()) — o
-- mesmo padrão já usado em clients/contacts/projects na Fase 2D.
-- project_tasks e project_files tinham INSERT/UPDATE restritos a
-- is_admin() desde a Fase 0 (o loop genérico original); relaxados
-- aqui porque toda a equipe provisionada precisa gerenciar tarefas e
-- arquivos do dia a dia.

-- ============================================================
-- projects — briefing + infraestrutura + encerramento
-- ============================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS briefing jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS briefing_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS infra_dominio text,
  ADD COLUMN IF NOT EXISTS infra_hospedagem text,
  ADD COLUMN IF NOT EXISTS infra_repositorio text,
  ADD COLUMN IF NOT EXISTS infra_homologacao_url text,
  ADD COLUMN IF NOT EXISTS infra_banco text,
  ADD COLUMN IF NOT EXISTS infra_observacoes text,
  ADD COLUMN IF NOT EXISTS data_finalizacao date,
  ADD COLUMN IF NOT EXISTS motivo_pausa text,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text;

-- ============================================================
-- project_tasks — subtarefas, prioridade, prazo, conclusão
-- ============================================================
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES project_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS prazo date,
  ADD COLUMN IF NOT EXISTS concluida_em timestamptz;

ALTER TABLE project_tasks ALTER COLUMN status SET DEFAULT 'a_fazer';
UPDATE project_tasks SET status = 'a_fazer' WHERE status = 'pendente';

ALTER TABLE project_tasks
  ADD CONSTRAINT project_tasks_status_check CHECK (status = ANY (ARRAY['a_fazer','em_andamento','concluida','bloqueada'])),
  ADD CONSTRAINT project_tasks_prioridade_check CHECK (prioridade = ANY (ARRAY['baixa','media','alta']));

CREATE INDEX IF NOT EXISTS idx_project_tasks_parent ON project_tasks (parent_task_id);

-- ============================================================
-- project_files — categoria do arquivo
-- ============================================================
ALTER TABLE project_files
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS descricao text;

ALTER TABLE project_files
  ADD CONSTRAINT project_files_tipo_check CHECK (tipo = ANY (ARRAY['imagem','pdf','documento','logo','briefing','referencia','outro']));

-- ============================================================
-- project_links (nova)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'outro' CHECK (tipo = ANY (ARRAY['producao','homologacao','figma','github','vercel','dominio','hospedagem','outro'])),
  url text NOT NULL,
  observacao text,
  criado_por uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_links_project ON project_links (project_id);

-- ============================================================
-- project_change_requests (nova) — alterações solicitadas
-- ============================================================
CREATE TABLE IF NOT EXISTS project_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  status text NOT NULL DEFAULT 'aberta' CHECK (status = ANY (ARRAY['aberta','em_andamento','concluida','cancelada'])),
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade = ANY (ARRAY['baixa','media','alta'])),
  solicitada_em timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz,
  observacoes text,
  criado_por uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_change_requests_project ON project_change_requests (project_id);

-- ============================================================
-- project_deploys (nova) — registro manual de deploys
-- ============================================================
CREATE TABLE IF NOT EXISTS project_deploys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ambiente text NOT NULL DEFAULT 'homologacao' CHECK (ambiente = ANY (ARRAY['homologacao','producao','outro'])),
  versao_descricao text,
  url text,
  data_deploy date NOT NULL DEFAULT current_date,
  responsavel_id uuid REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'sucesso' CHECK (status = ANY (ARRAY['sucesso','falha','pendente'])),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_deploys_project ON project_deploys (project_id);

-- ============================================================
-- RLS — tabelas novas
-- ============================================================
ALTER TABLE project_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_deploys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros provisionados podem ver project_links" ON project_links FOR SELECT USING (has_any_role());
CREATE POLICY "Membros provisionados podem criar project_links" ON project_links FOR INSERT WITH CHECK (has_any_role());
CREATE POLICY "Membros provisionados podem atualizar project_links" ON project_links FOR UPDATE USING (has_any_role());
CREATE POLICY "Administrador pode excluir project_links" ON project_links FOR DELETE USING (is_admin());

CREATE POLICY "Membros provisionados podem ver project_change_requests" ON project_change_requests FOR SELECT USING (has_any_role());
CREATE POLICY "Membros provisionados podem criar project_change_requests" ON project_change_requests FOR INSERT WITH CHECK (has_any_role());
CREATE POLICY "Membros provisionados podem atualizar project_change_requests" ON project_change_requests FOR UPDATE USING (has_any_role());
CREATE POLICY "Administrador pode excluir project_change_requests" ON project_change_requests FOR DELETE USING (is_admin());

CREATE POLICY "Membros provisionados podem ver project_deploys" ON project_deploys FOR SELECT USING (has_any_role());
CREATE POLICY "Membros provisionados podem criar project_deploys" ON project_deploys FOR INSERT WITH CHECK (has_any_role());
CREATE POLICY "Membros provisionados podem atualizar project_deploys" ON project_deploys FOR UPDATE USING (has_any_role());
CREATE POLICY "Administrador pode excluir project_deploys" ON project_deploys FOR DELETE USING (is_admin());

-- ============================================================
-- RLS — relaxa INSERT/UPDATE de project_tasks/project_files para a
-- equipe inteira (estavam restritos a is_admin() desde a Fase 0)
-- ============================================================
ALTER POLICY "Administrador pode criar project_tasks" ON project_tasks RENAME TO "Membros provisionados podem criar project_tasks";
ALTER POLICY "Membros provisionados podem criar project_tasks" ON project_tasks WITH CHECK (has_any_role());

ALTER POLICY "Administrador pode atualizar project_tasks" ON project_tasks RENAME TO "Membros provisionados podem atualizar project_tasks";
ALTER POLICY "Membros provisionados podem atualizar project_tasks" ON project_tasks USING (has_any_role());

ALTER POLICY "Administrador pode criar project_files" ON project_files RENAME TO "Membros provisionados podem criar project_files";
ALTER POLICY "Membros provisionados podem criar project_files" ON project_files WITH CHECK (has_any_role());

ALTER POLICY "Administrador pode atualizar project_files" ON project_files RENAME TO "Membros provisionados podem atualizar project_files";
ALTER POLICY "Membros provisionados podem atualizar project_files" ON project_files USING (has_any_role());
