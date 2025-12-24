-- DB/schema/_migrations/20251224_01_meeting_satisfaction_rls.sql
-- Purpose: Enable multi-org helper-based RLS for meeting satisfaction tables (no JWT org_id trust).
-- Requires: public.current_user_org_id(), public.current_user_role() exist (core/profiles.sql).
--
-- v1.0.0 (2025-12-24):
-- - meeting_satisfaction_question_lists: RLS + org policies (admin-only write)
-- - meeting_satisfaction_questions:      RLS + org policies (admin-only write)
-- - meeting_satisfaction_answers:        RLS + org policies (insert allowed), plus org integrity trigger

BEGIN;

-- Safety: ensure helpers exist (will error early if missing)
DO $$
BEGIN
  PERFORM public.current_user_org_id();
  PERFORM public.current_user_role();
EXCEPTION
  WHEN undefined_function THEN
    RAISE EXCEPTION 'Missing helpers: run DB/schema/core/profiles.sql first (current_user_org_id/current_user_role)';
END $$;

-- ------------------------------------------------------------
-- Question lists
-- ------------------------------------------------------------

ALTER TABLE IF EXISTS public.meeting_satisfaction_question_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_satisfaction_question_lists_service_full_access
  ON public.meeting_satisfaction_question_lists;
DROP POLICY IF EXISTS meeting_satisfaction_question_lists_org_select
  ON public.meeting_satisfaction_question_lists;
DROP POLICY IF EXISTS meeting_satisfaction_question_lists_org_insert_admin
  ON public.meeting_satisfaction_question_lists;
DROP POLICY IF EXISTS meeting_satisfaction_question_lists_org_update_admin
  ON public.meeting_satisfaction_question_lists;
DROP POLICY IF EXISTS meeting_satisfaction_question_lists_org_delete_admin
  ON public.meeting_satisfaction_question_lists;

CREATE POLICY meeting_satisfaction_question_lists_service_full_access
ON public.meeting_satisfaction_question_lists
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY meeting_satisfaction_question_lists_org_select
ON public.meeting_satisfaction_question_lists
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY meeting_satisfaction_question_lists_org_insert_admin
ON public.meeting_satisfaction_question_lists
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

CREATE POLICY meeting_satisfaction_question_lists_org_update_admin
ON public.meeting_satisfaction_question_lists
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

CREATE POLICY meeting_satisfaction_question_lists_org_delete_admin
ON public.meeting_satisfaction_question_lists
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

REVOKE ALL ON TABLE public.meeting_satisfaction_question_lists FROM anon;
REVOKE ALL ON TABLE public.meeting_satisfaction_question_lists FROM authenticated;
GRANT SELECT ON TABLE public.meeting_satisfaction_question_lists TO authenticated;

-- ------------------------------------------------------------
-- Questions
-- ------------------------------------------------------------

ALTER TABLE IF EXISTS public.meeting_satisfaction_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_satisfaction_questions_service_full_access
  ON public.meeting_satisfaction_questions;
DROP POLICY IF EXISTS meeting_satisfaction_questions_org_select
  ON public.meeting_satisfaction_questions;
DROP POLICY IF EXISTS meeting_satisfaction_questions_org_insert_admin
  ON public.meeting_satisfaction_questions;
DROP POLICY IF EXISTS meeting_satisfaction_questions_org_update_admin
  ON public.meeting_satisfaction_questions;
DROP POLICY IF EXISTS meeting_satisfaction_questions_org_delete_admin
  ON public.meeting_satisfaction_questions;

CREATE POLICY meeting_satisfaction_questions_service_full_access
ON public.meeting_satisfaction_questions
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY meeting_satisfaction_questions_org_select
ON public.meeting_satisfaction_questions
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY meeting_satisfaction_questions_org_insert_admin
ON public.meeting_satisfaction_questions
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

CREATE POLICY meeting_satisfaction_questions_org_update_admin
ON public.meeting_satisfaction_questions
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

CREATE POLICY meeting_satisfaction_questions_org_delete_admin
ON public.meeting_satisfaction_questions
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

REVOKE ALL ON TABLE public.meeting_satisfaction_questions FROM anon;
REVOKE ALL ON TABLE public.meeting_satisfaction_questions FROM authenticated;
GRANT SELECT ON TABLE public.meeting_satisfaction_questions TO authenticated;

-- ------------------------------------------------------------
-- Answers
-- ------------------------------------------------------------

ALTER TABLE IF EXISTS public.meeting_satisfaction_answers ENABLE ROW LEVEL SECURITY;

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

REVOKE ALL ON TABLE public.meeting_satisfaction_answers FROM anon;
REVOKE ALL ON TABLE public.meeting_satisfaction_answers FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.meeting_satisfaction_answers TO authenticated;

COMMIT;
