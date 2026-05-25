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
USING (
  org_id = public.current_user_org_id()
  AND (
    public.current_user_role() = 'admin'
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
  )
);

CREATE POLICY task_comments_select_by_org
ON public.task_comments FOR SELECT TO authenticated
USING (
  org_id = public.current_user_org_id()
  AND EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_comments.task_id
      AND t.org_id = public.current_user_org_id()
      AND (
        public.current_user_role() = 'admin'
        OR t.created_by = auth.uid()
        OR t.assigned_to = auth.uid()
      )
  )
);

CREATE POLICY task_comments_insert_by_org
ON public.task_comments FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.current_user_org_id()
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_comments.task_id
      AND t.org_id = public.current_user_org_id()
      AND (
        public.current_user_role() = 'admin'
        OR t.created_by = auth.uid()
        OR t.assigned_to = auth.uid()
      )
  )
);

REVOKE ALL ON TABLE public.tasks FROM anon;
REVOKE ALL ON TABLE public.tasks FROM authenticated;
REVOKE ALL ON TABLE public.task_comments FROM anon;
REVOKE ALL ON TABLE public.task_comments FROM authenticated;
GRANT SELECT ON TABLE public.tasks TO authenticated;
GRANT SELECT, INSERT ON TABLE public.task_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.task_comments TO service_role;

CREATE OR REPLACE FUNCTION public.create_task(
  p_title text,
  p_description text DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_due_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_org_id uuid := public.current_user_org_id();
  v_user_id uuid := auth.uid();
  v_task_id uuid;
BEGIN
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_NO_ORG' USING ERRCODE = '42501';
  END IF;

  IF nullif(trim(coalesce(p_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'TASK_TITLE_REQUIRED';
  END IF;

  IF coalesce(p_priority, 'normal') NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'TASK_PRIORITY_INVALID';
  END IF;

  IF p_assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_assigned_to
      AND p.org_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'TASK_ASSIGNEE_FORBIDDEN_OR_NOT_FOUND' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.tasks (
    org_id,
    title,
    description,
    priority,
    assigned_to,
    created_by,
    due_at
  )
  VALUES (
    v_org_id,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_priority, 'normal'),
    p_assigned_to,
    v_user_id,
    p_due_at
  )
  RETURNING id INTO v_task_id;

  RETURN v_task_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_task(
  p_task_id uuid,
  p_title text,
  p_description text DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_due_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_org_id uuid := public.current_user_org_id();
  v_user_id uuid := auth.uid();
  v_task public.tasks%ROWTYPE;
BEGIN
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_NO_ORG' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
    AND org_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF public.current_user_role() <> 'admin'
     AND v_task.created_by IS DISTINCT FROM v_user_id
     AND v_task.assigned_to IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'TASK_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF nullif(trim(coalesce(p_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'TASK_TITLE_REQUIRED';
  END IF;

  IF coalesce(p_priority, 'normal') NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'TASK_PRIORITY_INVALID';
  END IF;

  IF p_assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_assigned_to
      AND p.org_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'TASK_ASSIGNEE_FORBIDDEN_OR_NOT_FOUND' USING ERRCODE = '42501';
  END IF;

  UPDATE public.tasks
  SET
    title = trim(p_title),
    description = nullif(trim(coalesce(p_description, '')), ''),
    assigned_to = p_assigned_to,
    priority = coalesce(p_priority, 'normal'),
    due_at = p_due_at,
    updated_at = now()
  WHERE id = p_task_id
    AND org_id = v_org_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_task_status(
  p_task_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_org_id uuid := public.current_user_org_id();
  v_user_id uuid := auth.uid();
  v_task public.tasks%ROWTYPE;
BEGIN
  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_NO_ORG' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('open', 'in_progress', 'done', 'cancelled') THEN
    RAISE EXCEPTION 'TASK_STATUS_INVALID';
  END IF;

  SELECT *
  INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
    AND org_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF public.current_user_role() <> 'admin'
     AND v_task.created_by IS DISTINCT FROM v_user_id
     AND v_task.assigned_to IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'TASK_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  UPDATE public.tasks
  SET
    status = p_status,
    completed_at = CASE WHEN p_status = 'done' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_task_id
    AND org_id = v_org_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_task(text, text, uuid, text, timestamptz)
FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_task(uuid, text, text, uuid, text, timestamptz)
FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_task_status(uuid, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_task(text, text, uuid, text, timestamptz)
TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_task(uuid, text, text, uuid, text, timestamptz)
TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_task_status(uuid, text)
TO authenticated, service_role;
