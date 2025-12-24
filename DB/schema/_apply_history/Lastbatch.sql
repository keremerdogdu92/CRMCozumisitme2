-- =====================================================================
-- MIGRATION: Align RLS policies with helper-based multi-org standard
-- Targets:
--  - public.meeting_payments
--  - public.meeting_accessories
--  - public.patient_installment_plans
--  - public.patient_sale_breakdown
--  - public.patients_import_rows
--  - public.patients_legacy_devices_import_rows
--  - public.device_repairs
--
-- Safe mode:
--  - Does NOT change table columns (no ALTER COLUMN / ADD COLUMN here)
--  - Drops and recreates RLS policies deterministically
--  - Adds missing indexes where harmless
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0) Preflight: required helpers must exist
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'current_user_org_id'
  ) THEN
    RAISE EXCEPTION 'Missing required function public.current_user_org_id()';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'current_user_role'
  ) THEN
    RAISE EXCEPTION 'Missing required function public.current_user_role()';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 1) meeting_payments
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS public.meeting_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_payments_select_by_org ON public.meeting_payments;
DROP POLICY IF EXISTS meeting_payments_insert_by_org ON public.meeting_payments;
DROP POLICY IF EXISTS meeting_payments_update_by_org ON public.meeting_payments;
DROP POLICY IF EXISTS meeting_payments_service_full_access ON public.meeting_payments;

CREATE POLICY meeting_payments_service_full_access
ON public.meeting_payments
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY meeting_payments_select_by_org
ON public.meeting_payments
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY meeting_payments_insert_by_org
ON public.meeting_payments
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY meeting_payments_update_by_org
ON public.meeting_payments
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

REVOKE ALL ON TABLE public.meeting_payments FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.meeting_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.meeting_payments TO service_role;

-- ---------------------------------------------------------------------
-- 2) meeting_accessories
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS public.meeting_accessories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_accessories_select_by_org ON public.meeting_accessories;
DROP POLICY IF EXISTS meeting_accessories_insert_by_org ON public.meeting_accessories;
DROP POLICY IF EXISTS meeting_accessories_update_by_org ON public.meeting_accessories;
DROP POLICY IF EXISTS meeting_accessories_service_full_access ON public.meeting_accessories;

CREATE POLICY meeting_accessories_service_full_access
ON public.meeting_accessories
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY meeting_accessories_select_by_org
ON public.meeting_accessories
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY meeting_accessories_insert_by_org
ON public.meeting_accessories
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY meeting_accessories_update_by_org
ON public.meeting_accessories
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

REVOKE ALL ON TABLE public.meeting_accessories FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.meeting_accessories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.meeting_accessories TO service_role;

-- ---------------------------------------------------------------------
-- 3) patient_installment_plans
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS public.patient_installment_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_installment_plans_org_select ON public.patient_installment_plans;
DROP POLICY IF EXISTS patient_installment_plans_org_write ON public.patient_installment_plans;
DROP POLICY IF EXISTS patient_installment_plans_service_full_access ON public.patient_installment_plans;

CREATE POLICY patient_installment_plans_service_full_access
ON public.patient_installment_plans
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY patient_installment_plans_org_select
ON public.patient_installment_plans
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patient_installment_plans_org_write
ON public.patient_installment_plans
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

REVOKE ALL ON TABLE public.patient_installment_plans FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_installment_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.patient_installment_plans TO service_role;

-- ---------------------------------------------------------------------
-- 4) patient_sale_breakdown
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS public.patient_sale_breakdown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_sale_breakdown_select_by_org ON public.patient_sale_breakdown;
DROP POLICY IF EXISTS patient_sale_breakdown_insert_by_org ON public.patient_sale_breakdown;
DROP POLICY IF EXISTS patient_sale_breakdown_update_by_org ON public.patient_sale_breakdown;
DROP POLICY IF EXISTS patient_sale_breakdown_service_full_access ON public.patient_sale_breakdown;

CREATE POLICY patient_sale_breakdown_service_full_access
ON public.patient_sale_breakdown
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY patient_sale_breakdown_select_by_org
ON public.patient_sale_breakdown
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patient_sale_breakdown_insert_by_org
ON public.patient_sale_breakdown
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patient_sale_breakdown_update_by_org
ON public.patient_sale_breakdown
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

REVOKE ALL ON TABLE public.patient_sale_breakdown FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.patient_sale_breakdown TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.patient_sale_breakdown TO service_role;

-- ---------------------------------------------------------------------
-- 5) patients_import_rows (remove debug/JWT policies, add helper-based)
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS public.patients_import_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patients_import_rows_debug_allow_all ON public.patients_import_rows;
DROP POLICY IF EXISTS patients_import_rows_org_insert ON public.patients_import_rows;
DROP POLICY IF EXISTS patients_import_rows_org_select ON public.patients_import_rows;
DROP POLICY IF EXISTS patients_import_rows_org_update ON public.patients_import_rows;
DROP POLICY IF EXISTS patients_import_rows_select ON public.patients_import_rows;
DROP POLICY IF EXISTS patients_import_rows_write ON public.patients_import_rows;
DROP POLICY IF EXISTS patients_import_rows_service_full_access ON public.patients_import_rows;

CREATE POLICY patients_import_rows_service_full_access
ON public.patients_import_rows
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY patients_import_rows_select_by_org
ON public.patients_import_rows
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patients_import_rows_insert_by_org
ON public.patients_import_rows
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patients_import_rows_update_by_org
ON public.patients_import_rows
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

REVOKE ALL ON TABLE public.patients_import_rows FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.patients_import_rows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.patients_import_rows TO service_role;

-- ---------------------------------------------------------------------
-- 6) patients_legacy_devices_import_rows (ensure RLS exists & is helper-based)
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS public.patients_legacy_devices_import_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patients_legacy_devices_import_rows_service_full_access ON public.patients_legacy_devices_import_rows;
DROP POLICY IF EXISTS patients_legacy_devices_import_rows_select_by_org ON public.patients_legacy_devices_import_rows;
DROP POLICY IF EXISTS patients_legacy_devices_import_rows_write_by_org ON public.patients_legacy_devices_import_rows;

CREATE POLICY patients_legacy_devices_import_rows_service_full_access
ON public.patients_legacy_devices_import_rows
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY patients_legacy_devices_import_rows_select_by_org
ON public.patients_legacy_devices_import_rows
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patients_legacy_devices_import_rows_write_by_org
ON public.patients_legacy_devices_import_rows
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

REVOKE ALL ON TABLE public.patients_legacy_devices_import_rows FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patients_legacy_devices_import_rows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.patients_legacy_devices_import_rows TO service_role;

-- ---------------------------------------------------------------------
-- 7) device_repairs (replace JWT claim org_id policies with helper-based)
-- ---------------------------------------------------------------------
ALTER TABLE IF EXISTS public.device_repairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_repairs_org_select ON public.device_repairs;
DROP POLICY IF EXISTS device_repairs_org_write ON public.device_repairs;
DROP POLICY IF EXISTS device_repairs_service_full_access ON public.device_repairs;

CREATE POLICY device_repairs_service_full_access
ON public.device_repairs
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY device_repairs_org_select
ON public.device_repairs
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY device_repairs_org_write
ON public.device_repairs
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

REVOKE ALL ON TABLE public.device_repairs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.device_repairs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.device_repairs TO service_role;

COMMIT;
