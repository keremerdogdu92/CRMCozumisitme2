-- DB/schema/_migrations_apply_latest.sql
-- Purpose: Apply multi-org helper-based RLS (no JWT org_id trust) across core + selected tables.
-- v1.0.0 (2025-12-24):
-- - Ensures core helpers exist: public.current_user_org_id(), public.current_user_role()
-- - Ensures helper grants are correct (authenticated + service_role)
-- - Replaces open / JWT-based RLS on:
--   * public.patients
--   * public.devices
--   * public.patient_devices
--   * public.trials
-- Safe to re-run: uses DROP POLICY IF EXISTS and CREATE OR REPLACE.
-- IMPORTANT:
-- - Run as postgres / owner in Supabase SQL Editor.
-- - If you use hard-delete in app for some tables, DELETE policies remain enabled.

BEGIN;

-- =============================================================================
-- 0) CORE HELPERS (idempotent)
-- =============================================================================

-- Ensure helpers exist (canonical definitions in core/profiles.sql).
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.org_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

-- Lock down helper function visibility + grant explicit execute
REVOKE ALL ON FUNCTION public.current_user_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO service_role;

-- =============================================================================
-- 1) PATIENTS: remove open access + apply org-scoped policies
-- =============================================================================

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patients_all_authenticated ON public.patients;
DROP POLICY IF EXISTS patients_service_full_access ON public.patients;
DROP POLICY IF EXISTS patients_select_by_org ON public.patients;
DROP POLICY IF EXISTS patients_insert_by_org ON public.patients;
DROP POLICY IF EXISTS patients_update_by_org ON public.patients;
DROP POLICY IF EXISTS patients_delete_by_org ON public.patients;

CREATE POLICY patients_service_full_access
ON public.patients
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY patients_select_by_org
ON public.patients
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patients_insert_by_org
ON public.patients
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patients_update_by_org
ON public.patients
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- Hard delete allowed for now (matches your current approach)
CREATE POLICY patients_delete_by_org
ON public.patients
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- =============================================================================
-- 2) DEVICES: replace JWT-based policies with helper-based policies
-- =============================================================================

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS devices_select ON public.devices;
DROP POLICY IF EXISTS devices_write ON public.devices;
DROP POLICY IF EXISTS devices_service_full_access ON public.devices;
DROP POLICY IF EXISTS devices_select_by_org ON public.devices;
DROP POLICY IF EXISTS devices_insert_by_org ON public.devices;
DROP POLICY IF EXISTS devices_update_by_org ON public.devices;
DROP POLICY IF EXISTS devices_delete_by_org ON public.devices;

CREATE POLICY devices_service_full_access
ON public.devices
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY devices_select_by_org
ON public.devices
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY devices_insert_by_org
ON public.devices
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY devices_update_by_org
ON public.devices
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY devices_delete_by_org
ON public.devices
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- =============================================================================
-- 3) PATIENT_DEVICES: replace JWT-based policies with helper-based policies
-- =============================================================================

ALTER TABLE public.patient_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_devices_select ON public.patient_devices;
DROP POLICY IF EXISTS patient_devices_write ON public.patient_devices;
DROP POLICY IF EXISTS patient_devices_service_full_access ON public.patient_devices;
DROP POLICY IF EXISTS patient_devices_select_by_org ON public.patient_devices;
DROP POLICY IF EXISTS patient_devices_insert_by_org ON public.patient_devices;
DROP POLICY IF EXISTS patient_devices_update_by_org ON public.patient_devices;
DROP POLICY IF EXISTS patient_devices_delete_by_org ON public.patient_devices;

CREATE POLICY patient_devices_service_full_access
ON public.patient_devices
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY patient_devices_select_by_org
ON public.patient_devices
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patient_devices_insert_by_org
ON public.patient_devices
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patient_devices_update_by_org
ON public.patient_devices
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- Hard delete allowed for now
CREATE POLICY patient_devices_delete_by_org
ON public.patient_devices
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- =============================================================================
-- 4) TRIALS: remove JWT usage + enforce staff/admin visibility
-- =============================================================================

ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trials_service_full_access" ON public.trials;
DROP POLICY IF EXISTS "trials_org_select" ON public.trials;
DROP POLICY IF EXISTS "trials_org_insert" ON public.trials;
DROP POLICY IF EXISTS "trials_org_update" ON public.trials;
DROP POLICY IF EXISTS "trials_org_delete" ON public.trials;

CREATE POLICY "trials_service_full_access"
ON public.trials
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "trials_org_select"
ON public.trials
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (deleted_at IS NULL OR public.current_user_role() = 'admin')
  )
);

CREATE POLICY "trials_org_insert"
ON public.trials
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY "trials_org_update"
ON public.trials
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY "trials_org_delete"
ON public.trials
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

COMMIT;
