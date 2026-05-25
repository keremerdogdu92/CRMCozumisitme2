-- 20260525_task_security_satisfaction_prompts_apply.sql
-- Purpose:
-- - Add profiles.display_name for task assignee labels.
-- - Restrict task visibility/editing by admin vs created/assigned staff.
-- - Move task create/update/status writes to SECURITY DEFINER RPCs.
-- - Add satisfaction prompt tracking and mixed-list save RPC.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text NULL;

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;

CREATE POLICY profiles_update_self
ON public.profiles
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
)
WITH CHECK (
  id = auth.uid()
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_org_id uuid;
  v_role text;
  v_display_name text;
BEGIN
  v_org_id := nullif(new.raw_user_meta_data->>'org_id', '')::uuid;
  v_role := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'staff');

  IF v_role NOT IN ('admin','staff') THEN
    v_role := 'staff';
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'org_id is required in user_metadata to create profile';
  END IF;

  v_display_name := nullif(
    trim(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', '')),
    ''
  );

  INSERT INTO public.profiles (id, org_id, role, display_name, is_admin)
  VALUES (new.id, v_org_id, v_role, v_display_name, (v_role = 'admin'))
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$function$;

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
    SELECT 1 FROM public.profiles p WHERE p.id = p_assigned_to AND p.org_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'TASK_ASSIGNEE_FORBIDDEN_OR_NOT_FOUND' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.tasks (org_id, title, description, priority, assigned_to, created_by, due_at)
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

  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id AND org_id = v_org_id AND deleted_at IS NULL
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
    SELECT 1 FROM public.profiles p WHERE p.id = p_assigned_to AND p.org_id = v_org_id
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
  WHERE id = p_task_id AND org_id = v_org_id;
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

  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id AND org_id = v_org_id AND deleted_at IS NULL
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
  WHERE id = p_task_id AND org_id = v_org_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_task(text, text, uuid, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_task(uuid, text, text, uuid, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_task_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_task(text, text, uuid, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_task(uuid, text, text, uuid, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_task_status(uuid, text) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.meeting_satisfaction_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.meeting_satisfaction_question_lists(id) ON DELETE RESTRICT,
  question_id uuid NOT NULL REFERENCES public.meeting_satisfaction_questions(id) ON DELETE RESTRICT,
  prompt_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_satisfaction_prompts_meeting_question_unique UNIQUE (meeting_id, question_id)
);

CREATE INDEX IF NOT EXISTS meeting_satisfaction_prompts_patient_cycle_idx
  ON public.meeting_satisfaction_prompts (org_id, patient_id, list_id, question_id);
CREATE INDEX IF NOT EXISTS meeting_satisfaction_prompts_meeting_order_idx
  ON public.meeting_satisfaction_prompts (org_id, meeting_id, prompt_order);

ALTER TABLE public.meeting_satisfaction_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_satisfaction_prompts_service_full_access ON public.meeting_satisfaction_prompts;
DROP POLICY IF EXISTS meeting_satisfaction_prompts_org_select ON public.meeting_satisfaction_prompts;

CREATE POLICY meeting_satisfaction_prompts_service_full_access
ON public.meeting_satisfaction_prompts
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY meeting_satisfaction_prompts_org_select
ON public.meeting_satisfaction_prompts
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

REVOKE ALL ON TABLE public.meeting_satisfaction_prompts FROM anon;
REVOKE ALL ON TABLE public.meeting_satisfaction_prompts FROM authenticated;
GRANT SELECT ON TABLE public.meeting_satisfaction_prompts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.meeting_satisfaction_prompts TO service_role;

CREATE OR REPLACE FUNCTION public.get_patient_satisfaction_prompt_questions(
  p_patient_id uuid,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  question_id uuid,
  list_id uuid,
  list_name text,
  question_text text,
  sort_order integer,
  prompt_order integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id uuid := public.current_user_org_id();
  v_limit integer := greatest(1, least(coalesce(p_limit, 5), 20));
  v_patient_org uuid;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_NO_ORG' USING ERRCODE = '42501';
  END IF;

  SELECT p.org_id INTO v_patient_org
  FROM public.patients p
  WHERE p.id = p_patient_id AND p.deleted_at IS NULL;

  IF v_patient_org IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'SATISFACTION_PATIENT_FORBIDDEN_OR_NOT_FOUND' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH active_questions AS (
    SELECT q.id AS question_id, q.list_id, l.name AS list_name, q.question_text, q.sort_order
    FROM public.meeting_satisfaction_questions q
    JOIN public.meeting_satisfaction_question_lists l
      ON l.id = q.list_id AND l.org_id = v_org_id AND l.is_active IS TRUE
    WHERE q.org_id = v_org_id AND q.is_active IS TRUE
  ),
  list_progress AS (
    SELECT aq.list_id, count(*)::integer AS active_count, count(DISTINCT p.question_id)::integer AS shown_count
    FROM active_questions aq
    LEFT JOIN public.meeting_satisfaction_prompts p
      ON p.org_id = v_org_id
      AND p.patient_id = p_patient_id
      AND p.list_id = aq.list_id
      AND p.question_id = aq.question_id
    GROUP BY aq.list_id
  ),
  eligible AS (
    SELECT
      aq.*,
      row_number() OVER (PARTITION BY aq.list_id ORDER BY aq.sort_order ASC, aq.question_id ASC) AS list_rank
    FROM active_questions aq
    JOIN list_progress lp ON lp.list_id = aq.list_id
    WHERE lp.shown_count >= lp.active_count
       OR NOT EXISTS (
         SELECT 1
         FROM public.meeting_satisfaction_prompts p
         WHERE p.org_id = v_org_id
           AND p.patient_id = p_patient_id
           AND p.list_id = aq.list_id
           AND p.question_id = aq.question_id
       )
  ),
  mixed AS (
    SELECT
      e.question_id,
      e.list_id,
      e.list_name,
      e.question_text,
      e.sort_order,
      row_number() OVER (
        ORDER BY e.list_rank ASC, lower(e.list_name) ASC, e.sort_order ASC, e.question_id ASC
      )::integer AS prompt_order
    FROM eligible e
  )
  SELECT m.question_id, m.list_id, m.list_name, m.question_text, m.sort_order, m.prompt_order
  FROM mixed m
  WHERE m.prompt_order <= v_limit
  ORDER BY m.prompt_order ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_meeting_satisfaction_prompt_questions(
  p_meeting_id uuid
)
RETURNS TABLE (
  prompt_id uuid,
  question_id uuid,
  list_id uuid,
  list_name text,
  question_text text,
  sort_order integer,
  prompt_order integer,
  score smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id uuid := public.current_user_org_id();
  v_meeting_org uuid;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_NO_ORG' USING ERRCODE = '42501';
  END IF;

  SELECT m.org_id INTO v_meeting_org
  FROM public.meetings m
  WHERE m.id = p_meeting_id AND m.deleted_at IS NULL;

  IF v_meeting_org IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'SATISFACTION_MEETING_FORBIDDEN_OR_NOT_FOUND' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.question_id, p.list_id, l.name, q.question_text, q.sort_order, p.prompt_order, a.score
  FROM public.meeting_satisfaction_prompts p
  JOIN public.meeting_satisfaction_questions q ON q.id = p.question_id AND q.org_id = v_org_id
  JOIN public.meeting_satisfaction_question_lists l ON l.id = p.list_id AND l.org_id = v_org_id
  LEFT JOIN public.meeting_satisfaction_answers a
    ON a.org_id = v_org_id AND a.meeting_id = p.meeting_id AND a.question_id = p.question_id
  WHERE p.org_id = v_org_id AND p.meeting_id = p_meeting_id
  ORDER BY p.prompt_order ASC, q.sort_order ASC;
END;
$function$;

DROP FUNCTION IF EXISTS public.save_meeting_satisfaction_answers(uuid, uuid, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.save_meeting_satisfaction_answers(
  p_meeting_id uuid,
  p_patient_id uuid,
  p_question_ids uuid[],
  p_answers jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id uuid := public.current_user_org_id();
  v_meeting record;
  v_patient_org uuid;
  v_average numeric;
  v_question_count integer;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_NO_ORG' USING ERRCODE = '42501';
  END IF;

  SELECT m.org_id, m.meeting_type, m.subject_id INTO v_meeting
  FROM public.meetings m
  WHERE m.id = p_meeting_id AND m.deleted_at IS NULL;

  SELECT p.org_id INTO v_patient_org
  FROM public.patients p
  WHERE p.id = p_patient_id AND p.deleted_at IS NULL;

  IF v_meeting.org_id IS DISTINCT FROM v_org_id
     OR v_patient_org IS DISTINCT FROM v_org_id
     OR v_meeting.meeting_type IS DISTINCT FROM 'patient'
     OR v_meeting.subject_id IS DISTINCT FROM p_patient_id THEN
    RAISE EXCEPTION 'SATISFACTION_CONTEXT_FORBIDDEN_OR_NOT_FOUND' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.meeting_satisfaction_answers WHERE org_id = v_org_id AND meeting_id = p_meeting_id;
  DELETE FROM public.meeting_satisfaction_prompts WHERE org_id = v_org_id AND meeting_id = p_meeting_id;

  WITH requested AS (
    SELECT qid.question_id, qid.prompt_order
    FROM unnest(coalesce(p_question_ids, ARRAY[]::uuid[]))
      WITH ORDINALITY AS qid(question_id, prompt_order)
  ),
  valid_questions AS (
    SELECT r.question_id, q.list_id, r.prompt_order
    FROM requested r
    JOIN public.meeting_satisfaction_questions q
      ON q.id = r.question_id AND q.org_id = v_org_id AND q.is_active IS TRUE
    JOIN public.meeting_satisfaction_question_lists l
      ON l.id = q.list_id AND l.org_id = v_org_id AND l.is_active IS TRUE
  )
  INSERT INTO public.meeting_satisfaction_prompts (
    org_id, meeting_id, patient_id, list_id, question_id, prompt_order
  )
  SELECT v_org_id, p_meeting_id, p_patient_id, vq.list_id, vq.question_id, vq.prompt_order::integer
  FROM valid_questions vq
  ON CONFLICT (meeting_id, question_id) DO NOTHING;

  SELECT count(*) INTO v_question_count
  FROM public.meeting_satisfaction_prompts
  WHERE org_id = v_org_id AND meeting_id = p_meeting_id;

  IF v_question_count = 0 THEN
    UPDATE public.meetings SET satisfaction_10 = NULL WHERE id = p_meeting_id AND org_id = v_org_id;
    RETURN;
  END IF;

  IF jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) = 'array'
     AND jsonb_array_length(coalesce(p_answers, '[]'::jsonb)) > 0 THEN
    INSERT INTO public.meeting_satisfaction_answers (
      org_id, meeting_id, patient_id, list_id, question_id, score
    )
    SELECT v_org_id, p_meeting_id, p_patient_id, p.list_id, p.question_id, parsed.score
    FROM jsonb_to_recordset(p_answers) AS parsed(question_id uuid, score smallint)
    JOIN public.meeting_satisfaction_prompts p
      ON p.org_id = v_org_id
      AND p.meeting_id = p_meeting_id
      AND p.question_id = parsed.question_id
    WHERE parsed.score BETWEEN 1 AND 5;
  END IF;

  SELECT avg(score)::numeric INTO v_average
  FROM public.meeting_satisfaction_answers
  WHERE org_id = v_org_id AND meeting_id = p_meeting_id;

  UPDATE public.meetings
  SET satisfaction_10 = CASE
      WHEN v_average IS NULL THEN NULL
      ELSE greatest(1, least(10, round(v_average * 2)::integer))
    END
  WHERE id = p_meeting_id AND org_id = v_org_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_patient_satisfaction_prompt_questions(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_meeting_satisfaction_prompt_questions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_meeting_satisfaction_answers(uuid, uuid, uuid[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patient_satisfaction_prompt_questions(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_meeting_satisfaction_prompt_questions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_meeting_satisfaction_answers(uuid, uuid, uuid[], jsonb) TO authenticated, service_role;
