-- DB/schema/trials/trials.sql
-- Purpose: Supabase table definition for `public.trials` (lead pipeline).
-- Integrations:
-- - Multi-org isolation via public.current_user_org_id() (never trust JWT org_id claims).
-- - Lead pipeline fields:
--   - status: active | converted | lost
--   - converted_patient_id: link to created/selected patient (trial is not deleted on conversion)
--   - lost_at + lost_reason: follow-up analysis when a lead is lost
-- - Soft delete via deleted_at/deleted_by/delete_reason + RPCs:
--   - public.soft_delete_trials(p_id, p_reason)
--   - public.restore_trials(p_id)
-- - Soft delete deleted_by stamping via trigger:
--   - public.trg_soft_delete_set_deleted_by() (core/soft_delete_helpers.sql)
--
-- v4.0.0 (2025-12-28):
-- - LEAD PIPELINE: Add status/lost/converted fields to treat trials as a lead pipeline.
-- - CONVERSION: Trial is NOT deleted on conversion; it becomes status='converted' with converted_patient_id set.
-- - SECURITY: Soft delete remains idempotent; no authenticated hard delete.

CREATE TABLE IF NOT EXISTS public.trials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  full_name text NULL,
  phone text NULL,
  first_meet_at timestamp with time zone NULL,
  next_meet_at timestamp with time zone NULL,
  reference_id uuid NULL,
  note text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),

  -- Lead pipeline fields
  status text NOT NULL DEFAULT 'active'::text,
  lost_at timestamptz NULL,
  lost_reason text NULL,
  converted_patient_id uuid NULL,

  -- Soft delete columns
  deleted_at timestamp with time zone NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT trials_pkey PRIMARY KEY (id),

  CONSTRAINT trials_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT trials_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES auth.users (id) ON DELETE SET NULL,

  CONSTRAINT trials_converted_patient_id_fkey
    FOREIGN KEY (converted_patient_id) REFERENCES public.patients (id) ON DELETE SET NULL,

  CONSTRAINT trials_status_check CHECK (
    status = ANY (ARRAY['active'::text, 'converted'::text, 'lost'::text])
  )
) TABLESPACE pg_default;

-- ============================================================
-- INDEXES
-- ============================================================

-- Soft delete filtering performance
CREATE INDEX IF NOT EXISTS trials_org_deleted_at_idx
  ON public.trials (org_id, deleted_at);

-- Default list behavior tends to query org + status + deleted_at
CREATE INDEX IF NOT EXISTS trials_org_status_deleted_at_idx
  ON public.trials (org_id, status, deleted_at);

-- ============================================================
-- SOFT DELETE TRIGGER (shared helper)
-- ============================================================

DROP TRIGGER IF EXISTS trg_trials_soft_delete_stamp ON public.trials;

CREATE TRIGGER trg_trials_soft_delete_stamp
BEFORE UPDATE OF deleted_at, deleted_by ON public.trials
FOR EACH ROW
EXECUTE FUNCTION public.trg_soft_delete_set_deleted_by();

-- ============================================================
-- SOFT DELETE RPCs (UI must call RPC; hard delete is disabled)
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_trials(p_id uuid, p_reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Idempotent: only soft delete if not already deleted.
  UPDATE public.trials
  SET deleted_at = now(),
      delete_reason = p_reason
  WHERE id = p_id
    AND org_id = public.current_user_org_id()
    AND deleted_at IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_trials(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_trials(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_trials(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Idempotent: only restore if deleted.
  UPDATE public.trials
  SET deleted_at = NULL,
      deleted_by = NULL,
      delete_reason = NULL
  WHERE id = p_id
    AND org_id = public.current_user_org_id()
    AND deleted_at IS NOT NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_trials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_trials(uuid) TO authenticated;

-- ============================================================
-- RLS POLICIES FOR public.trials
-- ============================================================

ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies
DROP POLICY IF EXISTS "trials_service_full_access" ON public.trials;
DROP POLICY IF EXISTS "trials_org_select" ON public.trials;
DROP POLICY IF EXISTS "trials_org_insert" ON public.trials;
DROP POLICY IF EXISTS "trials_org_update" ON public.trials;
DROP POLICY IF EXISTS "trials_org_delete" ON public.trials;

-- Service role full access
CREATE POLICY "trials_service_full_access"
ON public.trials
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- SELECT: everyone in org can see both active + deleted; UI filters by deleted_at + status.
CREATE POLICY "trials_org_select"
ON public.trials
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- INSERT: within org
CREATE POLICY "trials_org_insert"
ON public.trials
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- UPDATE: within org (includes lead pipeline updates + soft delete/restore via RPC updates)
CREATE POLICY "trials_org_update"
ON public.trials
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- NOTE:
-- - Hard delete is intentionally disabled for authenticated users.
-- - No DELETE policy is created.

-- Grants (RLS still applies)
REVOKE ALL ON TABLE public.trials FROM anon;

-- Authenticated: no DELETE
GRANT SELECT, INSERT, UPDATE ON TABLE public.trials TO authenticated;

-- Service role: full control for administrative operations
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.trials TO service_role;
