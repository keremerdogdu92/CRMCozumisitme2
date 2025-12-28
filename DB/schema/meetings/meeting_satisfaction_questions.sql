-- DB/schema/meetings/meeting_satisfaction_questions.sql
-- Summary: Supabase table definition for `public.meeting_satisfaction_questions`.
-- Individual questions attached to a question list (templates).
-- Integrates with:
-- - public.meeting_satisfaction_question_lists (list_id)
-- - public.orgs (org_id)
-- Security model:
-- - Multi-org isolation via public.current_user_org_id() (helper-based)
-- - SELECT allowed for authenticated within org
-- - INSERT/UPDATE/DELETE admin-only within org
-- - service_role full access
-- - anon no access
--
-- v1.1.0 (2025-12-24):
-- - Org-scoped RLS with admin-only write

CREATE TABLE IF NOT EXISTS public.meeting_satisfaction_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  list_id uuid NOT NULL REFERENCES public.meeting_satisfaction_question_lists(id) ON DELETE CASCADE,
  question_text text NOT NULL, -- e.g. "Cihaz ses kalitesinden memnun musunuz?"
  sort_order integer NOT NULL DEFAULT 0, -- order inside the list
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT meeting_satisfaction_questions_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS meeting_satisfaction_questions_org_list_sort_idx
  ON public.meeting_satisfaction_questions (org_id, list_id, sort_order);

CREATE INDEX IF NOT EXISTS meeting_satisfaction_questions_org_active_idx
  ON public.meeting_satisfaction_questions (org_id, is_active);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.meeting_satisfaction_questions ENABLE ROW LEVEL SECURITY;

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

-- ============================================================
-- GRANTS (RLS still applies)
-- ============================================================

REVOKE ALL ON TABLE public.meeting_satisfaction_questions FROM anon;
REVOKE ALL ON TABLE public.meeting_satisfaction_questions FROM authenticated;

GRANT SELECT ON TABLE public.meeting_satisfaction_questions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.meeting_satisfaction_questions
TO service_role;
