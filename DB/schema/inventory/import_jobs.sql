-- DB/schema/inventory/import_jobs.sql
-- Summary: Supabase table definition for `public.import_jobs`.
-- Tracks bulk import operations (inventory, patients, trials, legacy patient devices) with status and error metadata.
-- Integrates with:
-- - `public.orgs` via org_id
-- - `public.profiles` via created_by
-- - Soft delete + restore via RPCs:
--   - public.soft_delete_import_jobs(p_id uuid, p_reason text)
--   - public.restore_import_jobs(p_id uuid)
-- Security model:
-- - Multi-org isolation via public.current_user_org_id()
-- - No hard delete for authenticated (no DELETE policy; no DELETE privilege)
-- - Staff/admin can see active+deleted rows (UI filter uses deleted_at)
-- - Write (INSERT/UPDATE) allowed within org for authenticated (imports are a staff workflow)
-- - `service_role` has full access
-- - `anon` has no access
--
-- v2.0.0 (2025-12-28):
-- - SOFT DELETE: add deleted_at + deleted_by + delete_reason
-- - RPC: add soft_delete + restore functions (SECURITY DEFINER)
-- - INDEX: add (org_id, deleted_at)
-- - RLS: helper-based policies (no profiles subquery)
-- - GRANTS: remove anon; authenticated gets SELECT/INSERT/UPDATE only; service_role full

CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  target_entity text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  source_filename text NULL,
  row_count integer NULL DEFAULT 0,
  error_count integer NULL DEFAULT 0,
  created_at timestamp with time zone NULL DEFAULT now(),
  created_by uuid NULL,
  finished_at timestamp with time zone NULL,
  error_message text NULL,

  -- Soft delete
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT import_jobs_pkey PRIMARY KEY (id),

  CONSTRAINT import_jobs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles (id) ON DELETE SET NULL,

  CONSTRAINT import_jobs_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT import_jobs_status_check CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'processing'::text,
        'completed'::text,
        'failed'::text
      ]
    )
  ),

  CONSTRAINT import_jobs_target_entity_check CHECK (
    target_entity = ANY (
      ARRAY[
        'inventory'::text,
        'patients'::text,
        'trials'::text,
        'legacy_patient_devices'::text
      ]
    )
  ),

  CONSTRAINT import_jobs_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES auth.users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS import_jobs_org_deleted_at_idx
  ON public.import_jobs (org_id, deleted_at);

CREATE INDEX IF NOT EXISTS import_jobs_org_created_at_idx
  ON public.import_jobs (org_id, created_at DESC);

-- ============================================================
-- SOFT DELETE TRIGGER (stamp deleted_by)
-- ============================================================
-- Requires: public.trg_soft_delete_set_deleted_by() helper exists in DB.
DROP TRIGGER IF EXISTS trg_import_jobs_soft_delete_stamp
ON public.import_jobs;

CREATE TRIGGER trg_import_jobs_soft_delete_stamp
BEFORE UPDATE OF deleted_at, deleted_by ON public.import_jobs
FOR EACH ROW
EXECUTE FUNCTION public.trg_soft_delete_set_deleted_by();

-- ============================================================
-- RPCs (soft delete + restore)
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_import_jobs(
  p_id uuid,
  p_reason text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_current_user_admin();

  UPDATE public.import_jobs
  SET deleted_at = now(),
      deleted_by = auth.uid(),
      delete_reason = p_reason
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_import_jobs(
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_current_user_admin();

  UPDATE public.import_jobs
  SET deleted_at = NULL,
      deleted_by = NULL,
      delete_reason = NULL
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

-- ============================================================
-- RLS POLICIES (multi-org, helper-based)
-- ============================================================

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_jobs_service_full_access ON public.import_jobs;
DROP POLICY IF EXISTS import_jobs_select_by_org ON public.import_jobs;
DROP POLICY IF EXISTS import_jobs_write_by_org ON public.import_jobs;

-- service_role full access
CREATE POLICY import_jobs_service_full_access
ON public.import_jobs
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- SELECT: org-scoped (includes deleted rows; UI filters via deleted_at)
CREATE POLICY import_jobs_select_by_org
ON public.import_jobs
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- INSERT/UPDATE: org-scoped for authenticated
-- Notes:
-- - Imports are an operational workflow; staff needs to create and update job states from the app.
-- - If you later want "admin-only UPDATE" again, we can tighten this to current_user_role()='admin'.
CREATE POLICY import_jobs_write_by_org
ON public.import_jobs
AS PERMISSIVE
FOR INSERT, UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- NO authenticated DELETE policy (hard delete disabled by privileges)

-- ============================================================
-- GRANTS (RLS still applies)
-- ============================================================

REVOKE ALL ON TABLE public.import_jobs FROM anon;
REVOKE ALL ON TABLE public.import_jobs FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.import_jobs TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.import_jobs
TO service_role;
