-- DB/schema/patients/patients.sql
-- Summary: Supabase table definition for `patients`, includes `sgk_recorded_to_system_at` (timestamptz).
-- Notes:
-- - `sgk_recorded_to_system_at` is a nullable timestamptz with no default.
-- - TODO: `sgk_recorded_to_system_at` should be set when `sgk_recorded_to_system` is toggled to true (app-level).
--
-- v3.0.0 (2025-12-24):
-- - SECURITY: Replace open RLS policy (USING true) with multi-org helper-based policies (no JWT trust).

CREATE TABLE public.patients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  full_name text NOT NULL,
  national_id text NULL,
  address text NULL,
  phone text NULL,
  kin_phone text NULL,
  sgk_prescription_no text NULL,
  sgk_flag boolean NULL DEFAULT false,
  sgk_docs_received boolean NULL DEFAULT false,
  sgk_processed boolean NULL DEFAULT false,
  satisfaction_10 integer NULL,
  created_at timestamptz NULL DEFAULT now(),
  last_visit_at timestamptz NULL,
  sgk_prescription_received boolean NOT NULL DEFAULT false,
  sgk_recorded_to_system boolean NOT NULL DEFAULT false,
  payment_method text NULL,
  sale_total_amount numeric(12, 2) NULL,
  card_fee_rate numeric(5, 2) NULL,
  card_fee_amount numeric(12, 2) NULL,
  reference_id uuid NULL,
  archive_code text NULL,
  invoice_issued boolean NOT NULL DEFAULT false,
  invoice_issued_at timestamptz NULL,
  sgk_profile text NULL,
  sgk_expected_reimbursement numeric(10, 2) NULL,
  sgk_expected_reimbursement_month date NULL,

  -- Soft delete columns
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  -- Battery patient marker:
  is_battery_patient boolean NOT NULL DEFAULT false,

  -- Timestamp for when sgk_recorded_to_system was recorded as true.
  sgk_recorded_to_system_at timestamptz NULL,

  CONSTRAINT patients_pkey PRIMARY KEY (id),

  CONSTRAINT patients_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT patients_reference_id_fkey FOREIGN KEY (reference_id)
    REFERENCES public."references" (id) ON DELETE SET NULL,

  CONSTRAINT patients_payment_method_check CHECK (
    payment_method IS NULL
    OR payment_method = ANY (
      ARRAY[
        'Tim'::text,
        'Sivantos'::text,
        'Kredi_Kartı'::text,
        'Nakit'::text,
        'Senet'::text,
        'legacy_unknown'::text
      ]
    )
  ),

  CONSTRAINT patients_satisfaction_10_check CHECK (
    satisfaction_10 >= 1 AND satisfaction_10 <= 10
  ),

  CONSTRAINT patients_sgk_flow CHECK (
    (sgk_processed IS NOT TRUE OR sgk_docs_received IS TRUE)
    AND (sgk_docs_received IS NOT TRUE OR sgk_flag IS TRUE)
  ),

  CONSTRAINT patients_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES auth.users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- Archive code trigger
CREATE TRIGGER trg_patients_archive_code
BEFORE INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION set_patient_archive_code();

-- ============================================================
-- INDEXES
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS patients_national_id_unique_not_deleted
ON public.patients (org_id, national_id)
WHERE national_id IS NOT NULL
  AND deleted_at IS NULL;

-- ============================================================
-- RLS POLICIES FOR public.patients (multi-org, no JWT trust)
-- ============================================================

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patients_all_authenticated ON public.patients;
DROP POLICY IF EXISTS patients_service_full_access ON public.patients;
DROP POLICY IF EXISTS patients_select_by_org ON public.patients;
DROP POLICY IF EXISTS patients_insert_by_org ON public.patients;
DROP POLICY IF EXISTS patients_update_by_org ON public.patients;
DROP POLICY IF EXISTS patients_delete_by_org ON public.patients;

-- service_role bypass
CREATE POLICY patients_service_full_access
ON public.patients
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- SELECT
CREATE POLICY patients_select_by_org
ON public.patients
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- INSERT
CREATE POLICY patients_insert_by_org
ON public.patients
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- UPDATE
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

-- DELETE (hard delete allowed for now)
CREATE POLICY patients_delete_by_org
ON public.patients
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);
