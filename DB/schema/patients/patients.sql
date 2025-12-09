-- db/schema/patients/patients.sql
-- Purpose: Supabase table definition for `patients`.
-- Includes: CREATE TABLE, constraints, triggers and RLS policies for patient rows.
-- Source of truth: Supabase table editor / migrations.
--
-- [TODO-SECURITY-BEFORE-PROD]
--   1) Confirm that all debug/bypass policies are removed.
--   2) Decide a single org resolution strategy and simplify policies.
--   3) Document the expected JWT claims (org_id, user_metadata.org_id, role).
--   4) Re-run a full regression test (single-org, multi-org, service_role).
--   5) Deletion model:
--      - Soft delete via deleted_at / deleted_by / delete_reason.
--      - Hard delete reserved for service_role (purge after retention window).

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
  created_at timestamp with time zone NULL DEFAULT now(),
  last_visit_at timestamp with time zone NULL,
  sgk_prescription_received boolean NOT NULL DEFAULT false,
  sgk_recorded_to_system boolean NOT NULL DEFAULT false,
  payment_method text NULL,
  sale_total_amount numeric(12, 2) NULL,
  card_fee_rate numeric(5, 2) NULL,
  card_fee_amount numeric(12, 2) NULL,
  reference_id uuid NULL,
  archive_code text NULL,
  invoice_issued boolean NOT NULL DEFAULT false,
  invoice_issued_at timestamp with time zone NULL,
  sgk_profile text NULL,
  sgk_expected_reimbursement numeric(10, 2) NULL,
  sgk_expected_reimbursement_month date NULL,

  -- Soft delete columns
  deleted_at timestamp with time zone NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

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
        'Senet'::text
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

-- Archive code trigger (unchanged)
CREATE TRIGGER trg_patients_archive_code
BEFORE INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION set_patient_archive_code();

-- ============================================================
-- INDEXES
-- ============================================================

-- TC kimlik numarası için benzersizlik:
-- Sadece national_id dolu ve deleted_at IS NULL olan (aktif) hastalar arasında UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS patients_national_id_unique_not_deleted
ON public.patients (org_id, national_id)
WHERE national_id IS NOT NULL
  AND deleted_at IS NULL;

-- ============================================================
-- RLS POLICIES FOR public.patients (soft delete aware)
-- ============================================================

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- INSERT: org_id must match JWT user_metadata.org_id
CREATE POLICY "patients_org_insert"
ON public.patients
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id)::text = ((auth.jwt() -> 'user_metadata'::text) ->> 'org_id'::text)
);

-- SELECT (authenticated): org_id from JWT user_metadata.org_id, only active rows
CREATE POLICY "patients_org_select"
ON public.patients
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (org_id)::text = ((auth.jwt() -> 'user_metadata'::text) ->> 'org_id'::text)
  AND deleted_at IS NULL
);

-- SELECT (authenticated): org_id from profiles.org_id, only active rows
CREATE POLICY "patients_profile_select"
ON public.patients
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  org_id = (
    SELECT profiles.org_id
    FROM public.profiles
    WHERE profiles.id = auth.uid()
    LIMIT 1
  )
  AND deleted_at IS NULL
);

-- UPDATE (authenticated): simplified, soft-delete aware
-- Any authenticated user can update active patients (deleted_at IS NULL).
-- This allows setting deleted_at / deleted_by / delete_reason for soft delete.
CREATE POLICY "patients_update_any_org_soft_delete"
ON public.patients
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  deleted_at IS NULL
)
WITH CHECK (
  true
);

-- SELECT (public): service_role sees everything; others by jwt org_id, active only
CREATE POLICY "patients_select"
ON public.patients
AS PERMISSIVE
FOR SELECT
TO public
USING (
  auth.role() = 'service_role'::text
  OR (
    (org_id)::text = (auth.jwt() ->> 'org_id'::text)
    AND deleted_at IS NULL
  )
);

-- ALL (INSERT/UPDATE/DELETE) for service_role only (backend / cron / purge)
CREATE POLICY "patients_write"
ON public.patients
AS PERMISSIVE
FOR ALL
TO public
USING (
  auth.role() = 'service_role'::text
)
WITH CHECK (
  auth.role() = 'service_role'::text
);
