-- DB/schema/meetings/meeting_satisfaction_answers.sql
-- Summary: Supabase table definition for `public.meeting_satisfaction_answers`.
-- Stores per-question 1-5 satisfaction scores for a meeting.
-- Integrates with:
-- - public.meetings (meeting_id)
-- - public.patients (patient_id)
-- - public.meeting_satisfaction_question_lists (list_id)
-- - public.meeting_satisfaction_questions (question_id)
-- - public.orgs (org_id)
-- Security model:
-- - Multi-org isolation via public.current_user_org_id()
-- - Staff/admin can INSERT within org (survey submission)
-- - UPDATE/DELETE are admin-only within org (answers mostly immutable)
-- - service_role full access
-- - anon no access
-- Data integrity:
-- - SECURITY DEFINER trigger enforces org_id consistency across referenced rows
--
-- v1.2.0 (2025-12-24):
-- - Org integrity enforcement trigger + org-scoped RLS

CREATE TABLE IF NOT EXISTS public.meeting_satisfaction_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.meeting_satisfaction_question_lists(id) ON DELETE RESTRICT,
  question_id uuid NOT NULL REFERENCES public.meeting_satisfaction_questions(id) ON DELETE RESTRICT,
  score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT meeting_satisfaction_answers_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS meeting_satisfaction_answers_meeting_idx
  ON public.meeting_satisfaction_answers (org_id, meeting_id);

CREATE INDEX IF NOT EXISTS meeting_satisfaction_answers_patient_idx
  ON public.meeting_satisfaction_answers (org_id, patient_id);

CREATE INDEX IF NOT EXISTS meeting_satisfaction_answers_list_idx
  ON public.meeting_satisfaction_answers (org_id, list_id);

CREATE INDEX IF NOT EXISTS meeting_satisfaction_answers_question_idx
  ON public.meeting_satisfaction_answers (org_id, question_id);

-- ============================================================
-- ORG INTEGRITY ENFORCEMENT
-- Prevent cross-org reference mistakes (meeting/patient/list/question must match org_id)
-- ============================================================

CREATE OR REPLACE FUNCTION public.meeting_satisfaction_answers_enforce_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_meeting_org uuid;
  v_patient_org uuid;
  v_list_org uuid;
  v_question_org uuid;
BEGIN
  -- service_role can bypass for backoffice repair/import operations.
  IF auth.role() = 'service_role'::text THEN
    RETURN NEW;
  END IF;

  SELECT m.org_id INTO v_meeting_org
  FROM public.meetings m
  WHERE m.id = NEW.meeting_id;

  SELECT p.org_id INTO v_patient_org
  FROM public.patients p
  WHERE p.id = NEW.patient_id;

  SELECT l.org_id INTO v_list_org
  FROM public.meeting_satisfaction_question_lists l
  WHERE l.id = NEW.list_id;

  SELECT q.org_id INTO v_question_org
  FROM public.meeting_satisfaction_questions q
  WHERE q.id = NEW.question_id;

  IF v_meeting_org IS NULL THEN
    RAISE EXCEPTION 'meeting_satisfaction_answers.meeting_id not found';
  END IF;

  IF v_patient_org IS NULL THEN
    RAISE EXCEPTION 'meeting_satisfaction_answers.patient_id not found';
  END IF;

  IF v_list_org IS NULL THEN
    RAISE EXCEPTION 'meeting_satisfaction_answers.list_id not found';
  END IF;

  IF v_question_org IS NULL THEN
    RAISE EXCEPTION 'meeting_satisfaction_answers.question_id not found';
  END IF;

  IF NEW.org_id IS DISTINCT FROM v_meeting_org
     OR NEW.org_id IS DISTINCT FROM v_patient_org
     OR NEW.org_id IS DISTINCT FROM v_list_org
     OR NEW.org_id IS DISTINCT FROM v_question_org THEN
    RAISE EXCEPTION 'meeting_satisfaction_answers.org_id must match org_id of meeting/patient/list/question';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_meeting_satisfaction_answers_enforce_org
  ON public.meeting_satisfaction_answers;

CREATE TRIGGER trg_meeting_satisfaction_answers_enforce_org
BEFORE INSERT OR UPDATE ON public.meeting_satisfaction_answers
FOR EACH ROW
EXECUTE FUNCTION public.meeting_satisfaction_answers_enforce_org();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.meeting_satisfaction_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_satisfaction_answers_service_full_access
  ON public.meeting_satisfaction_answers;
DROP POLICY IF EXISTS meeting_satisfaction_answers_org_select
  ON public.meeting_satisfaction_answers;
DROP POLICY IF EXISTS meeting_satisfaction_answers_org_insert
  ON public.meeting_satisfaction_answers;
DROP POLICY IF EXISTS meeting_satisfaction_answers_org_update_admin
  ON public.meeting_satisfaction_answers;
DROP POLICY IF EXISTS meeting_satisfaction_answers_org_delete_admin
  ON public.meeting_satisfaction_answers;

CREATE POLICY meeting_satisfaction_answers_service_full_access
ON public.meeting_satisfaction_answers
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY meeting_satisfaction_answers_org_select
ON public.meeting_satisfaction_answers
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY meeting_satisfaction_answers_org_insert
ON public.meeting_satisfaction_answers
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY meeting_satisfaction_answers_org_update_admin
ON public.meeting_satisfaction_answers
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

CREATE POLICY meeting_satisfaction_answers_org_delete_admin
ON public.meeting_satisfaction_answers
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

-- ============================================================
-- GRANTS (RLS still applies)
-- ============================================================

REVOKE ALL ON TABLE public.meeting_satisfaction_answers FROM anon;
REVOKE ALL ON TABLE public.meeting_satisfaction_answers FROM authenticated;

GRANT SELECT, INSERT ON TABLE public.meeting_satisfaction_answers TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.meeting_satisfaction_answers
TO service_role;

-- ============================================================
-- RPC: replace answers atomically and write 1-10 meeting summary
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_meeting_satisfaction_answers(
  p_meeting_id uuid,
  p_patient_id uuid,
  p_list_id uuid,
  p_answers jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id uuid := public.current_user_org_id();
  v_meeting_org uuid;
  v_patient_org uuid;
  v_list_org uuid;
  v_average numeric;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_NO_ORG' USING ERRCODE = '42501';
  END IF;

  SELECT org_id
  INTO v_meeting_org
  FROM public.meetings
  WHERE id = p_meeting_id
    AND meeting_type = 'patient'
    AND deleted_at IS NULL;

  SELECT org_id
  INTO v_patient_org
  FROM public.patients
  WHERE id = p_patient_id
    AND deleted_at IS NULL;

  SELECT org_id
  INTO v_list_org
  FROM public.meeting_satisfaction_question_lists
  WHERE id = p_list_id
    AND is_active IS TRUE;

  IF v_meeting_org IS DISTINCT FROM v_org_id
     OR v_patient_org IS DISTINCT FROM v_org_id
     OR v_list_org IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'SATISFACTION_CONTEXT_FORBIDDEN_OR_NOT_FOUND' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.meeting_satisfaction_answers
  WHERE org_id = v_org_id
    AND meeting_id = p_meeting_id;

  IF jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) = 'array'
     AND jsonb_array_length(coalesce(p_answers, '[]'::jsonb)) > 0 THEN
    INSERT INTO public.meeting_satisfaction_answers (
      org_id, meeting_id, patient_id, list_id, question_id, score
    )
    SELECT
      v_org_id,
      p_meeting_id,
      p_patient_id,
      p_list_id,
      parsed.question_id,
      parsed.score
    FROM jsonb_to_recordset(p_answers) AS parsed(question_id uuid, score smallint)
    JOIN public.meeting_satisfaction_questions q
      ON q.id = parsed.question_id
      AND q.org_id = v_org_id
      AND q.list_id = p_list_id
      AND q.is_active IS TRUE
    WHERE parsed.score BETWEEN 1 AND 5;
  END IF;

  SELECT avg(score)::numeric
  INTO v_average
  FROM public.meeting_satisfaction_answers
  WHERE org_id = v_org_id
    AND meeting_id = p_meeting_id;

  UPDATE public.meetings
  SET satisfaction_10 = CASE
      WHEN v_average IS NULL THEN NULL
      ELSE greatest(1, least(10, round(v_average * 2)::integer))
    END
  WHERE id = p_meeting_id
    AND org_id = v_org_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_meeting_satisfaction_answers(uuid, uuid, uuid, jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_meeting_satisfaction_answers(uuid, uuid, uuid, jsonb)
TO authenticated, service_role;
