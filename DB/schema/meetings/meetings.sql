-- DB/schema/meetings/meetings.sql
-- Purpose: Supabase table definition for `public.meetings`.
-- Integrations:
-- - Multi-org isolation via public.current_user_org_id().
-- - Meeting type gating:
--   - meeting_type = 'reference' rows are visible/writable only to admin (within org).
-- - Soft delete via deleted_at/deleted_by/delete_reason + RPCs:
--   - public.soft_delete_meetings(p_id, p_reason)
--   - public.restore_meetings(p_id)
-- - After-write trigger: meeting_after_write_trigger -> meeting_after_write().
--
-- v3.1.0 (2025-12-28):
-- - ALIGN WITH DB: add soft delete columns + deleted_by FK to auth.users.
-- - ALIGN WITH DB: add (org_id, deleted_at) index for soft-delete filtering performance.
-- - ALIGN WITH DB: disable hard delete for authenticated (no DELETE policy, no DELETE grant).
-- - KEEP: deterministic helper-based policies and trigger as-is.

CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  subject text NULL,
  note text NULL,
  at timestamp with time zone NULL,
  next_at timestamp with time zone NULL,
  satisfaction_10 integer NULL,
  patient_id uuid NULL,
  trial_id uuid NULL,
  reference_id uuid NULL,
  created_by uuid NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  meeting_type text NOT NULL DEFAULT 'patient'::text,
  subject_id uuid NULL,
  subject_name text NULL,

  -- Soft delete columns
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT meetings_pkey PRIMARY KEY (id),

  CONSTRAINT meetings_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES public.profiles (id)
    ON DELETE SET NULL,

  CONSTRAINT meetings_org_id_fkey
    FOREIGN KEY (org_id)
    REFERENCES public.orgs (id)
    ON DELETE CASCADE,

  CONSTRAINT meetings_patient_id_fkey
    FOREIGN KEY (patient_id)
    REFERENCES public.patients (id)
    ON DELETE SET NULL,

  CONSTRAINT meetings_trial_id_fkey
    FOREIGN KEY (trial_id)
    REFERENCES public.trials (id)
    ON DELETE SET NULL,

  CONSTRAINT meetings_satisfaction_10_check CHECK (
    satisfaction_10 >= 1 AND satisfaction_10 <= 10
  ),

  CONSTRAINT meetings_deleted_by_fkey
    FOREIGN KEY (deleted_by)
    REFERENCES auth.users (id)
    ON DELETE SET NULL
) TABLESPACE pg_default;

-- Trigger (kept as-is; fires on soft delete updates too)
DROP TRIGGER IF EXISTS meeting_after_write_trigger ON public.meetings;

CREATE TRIGGER meeting_after_write_trigger
AFTER INSERT OR UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION meeting_after_write();

-- ============================================================
-- INDEXES
-- ============================================================

-- Soft delete filtering performance
CREATE INDEX IF NOT EXISTS meetings_org_deleted_at_idx
ON public.meetings (org_id, deleted_at);

-- ============================================================
-- SOFT DELETE RPCs (UI must call RPC; hard delete is disabled)
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_meetings(p_id uuid, p_reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_current_user_admin();

  UPDATE public.meetings
  SET deleted_at = now(),
      deleted_by = auth.uid(),
      delete_reason = p_reason
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_meetings(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_meetings(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_meetings(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_current_user_admin();

  UPDATE public.meetings
  SET deleted_at = NULL,
      deleted_by = NULL,
      delete_reason = NULL
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_meetings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_meetings(uuid) TO authenticated;

-- ============================================================
-- RLS POLICIES FOR public.meetings
-- ============================================================

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies
DROP POLICY IF EXISTS meetings_select_by_org_and_type ON public.meetings;
DROP POLICY IF EXISTS meetings_insert_by_org_and_type ON public.meetings;
DROP POLICY IF EXISTS meetings_update_by_org_and_type ON public.meetings;
DROP POLICY IF EXISTS meetings_delete_by_org_and_type ON public.meetings;
DROP POLICY IF EXISTS meetings_delete_by_org ON public.meetings;

-- SELECT (includes deleted rows; UI filters by deleted_at if needed)
CREATE POLICY meetings_select_by_org_and_type
ON public.meetings
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
);

-- INSERT
CREATE POLICY meetings_insert_by_org_and_type
ON public.meetings
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
);

-- UPDATE (needed for editing meetings + soft delete updates via RPC)
CREATE POLICY meetings_update_by_org_and_type
ON public.meetings
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
);

-- NOTE:
-- - Hard delete is intentionally disabled for authenticated users.
-- - No DELETE policy is created.

-- Grants (RLS still applies)
REVOKE ALL ON TABLE public.meetings FROM anon;

-- Authenticated: no DELETE
GRANT SELECT, INSERT, UPDATE ON TABLE public.meetings TO authenticated;

-- Service role: full control for administrative operations
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.meetings TO service_role;
