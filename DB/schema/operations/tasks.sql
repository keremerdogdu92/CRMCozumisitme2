-- DB/schema/operations/tasks.sql
-- Purpose: Simple org-scoped user task system.

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  assigned_to uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  delete_reason text NULL,
  CONSTRAINT tasks_status_check CHECK (
    status = ANY (ARRAY['open'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text])
  ),
  CONSTRAINT tasks_priority_check CHECK (
    priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])
  )
);

CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_org_assigned_status_idx
  ON public.tasks (org_id, assigned_to, status, due_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS task_comments_task_idx
  ON public.task_comments (org_id, task_id, created_at);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_select_by_org ON public.tasks;
DROP POLICY IF EXISTS tasks_write_by_org ON public.tasks;
DROP POLICY IF EXISTS tasks_insert_by_org ON public.tasks;
DROP POLICY IF EXISTS tasks_update_by_org ON public.tasks;
DROP POLICY IF EXISTS tasks_delete_by_org ON public.tasks;
DROP POLICY IF EXISTS task_comments_select_by_org ON public.task_comments;
DROP POLICY IF EXISTS task_comments_write_by_org ON public.task_comments;
DROP POLICY IF EXISTS task_comments_insert_by_org ON public.task_comments;

CREATE POLICY tasks_select_by_org
ON public.tasks FOR SELECT TO authenticated
USING (org_id = public.current_user_org_id());

CREATE POLICY tasks_insert_by_org
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY tasks_update_by_org
ON public.tasks FOR UPDATE TO authenticated
USING (org_id = public.current_user_org_id())
WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY tasks_delete_by_org
ON public.tasks FOR DELETE TO authenticated
USING (org_id = public.current_user_org_id());

CREATE POLICY task_comments_select_by_org
ON public.task_comments FOR SELECT TO authenticated
USING (org_id = public.current_user_org_id());

CREATE POLICY task_comments_insert_by_org
ON public.task_comments FOR INSERT TO authenticated
WITH CHECK (org_id = public.current_user_org_id());

REVOKE ALL ON TABLE public.tasks FROM anon;
REVOKE ALL ON TABLE public.task_comments FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tasks TO authenticated;
GRANT SELECT, INSERT ON TABLE public.task_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.task_comments TO service_role;
