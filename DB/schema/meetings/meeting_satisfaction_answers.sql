-- DB/schema/meetings/meeting_satisfaction_answers.sql
-- Purpose: Stores per-question 1-5 satisfaction scores for a given meeting.
--
-- Multi-org standard:
-- - Org isolation via public.current_user_org_id() (never JWT claims).
-- - Inserts allowed within org (staff/admin) because staff will submit surveys.
-- - Updates/deletes restricted to admin/service_role (answers should be mostly immutable).
--
-- v1.2.0 (2025-12-24):
-- - ADD: org_id FK -> public.orgs
-- - ADD: RLS + policies + grants
-- - ADD: SECURITY DEFINER trigger to enforce org_id consistency across referenced rows
-- - KEEP: reporting indexes

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
SET search_path = public
AS $function$
DECLARE
  v_meeting_org uuid;
  v_patient_org uuid;
  v_list_org uuid;
  v_question_org uuid;
BEGIN
  -- service_role can bypass (data repair/import), but still validate if you want strictness.
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

-- Drop legacy policies (deterministic repo)
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

-- Service role full access
CREATE POLICY meeting_satisfaction_answers_service_full_access
ON public.meeting_satisfaction_answers
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- SELECT: org-scoped for authenticated
CREATE POLICY meeting_satisfaction_answers_org_select
ON public.meeting_satisfaction_answers
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- INSERT: within org for authenticated (staff/admin)
CREATE POLICY meeting_satisfaction_answers_org_insert
ON public.meeting_satisfaction_answers
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- UPDATE: admin-only within org
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

-- DELETE: admin-only within org
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
ON TABLE public.meeting_satisfaction_answers TO service_role;
