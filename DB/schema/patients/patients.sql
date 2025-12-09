-- DB/schema/patients/patients.sql
-- Purpose: Supabase table definition for `patients`.
-- Includes: CREATE TABLE, constraints, triggers and RLS policies for patient rows.
-- Source of truth: Supabase table editor / migrations.

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

CREATE UNIQUE INDEX IF NOT EXISTS patients_national_id_unique_not_deleted
ON public.patients (org_id, national_id)
WHERE national_id IS NOT NULL
  AND deleted_at IS NULL;

-- ============================================================
-- RLS POLICIES FOR public.patients
-- ============================================================

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- INSERT: org_id must match JWT user_metadata.org_id (legacy path – still allowed).
CREATE POLICY "patients_org_insert"
ON public.patients
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id)::text = ((auth.jwt() -> 'user_metadata'::text) ->> 'org_id'::text)
);

-- SELECT (JWT user_metadata.org_id) – optional legacy path.
CREATE POLICY "patients_org_select"
ON public.patients
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (org_id)::text = ((auth.jwt() -> 'user_metadata'::text) ->> 'org_id'::text)
  AND deleted_at IS NULL
);

-- UPDATE: profiles.org_id based, soft delete aware.
CREATE POLICY "patients_profile_update"
ON public.patients
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  org_id = (
    SELECT p.org_id
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
    LIMIT 1
  )
  AND deleted_at IS NULL
)
WITH CHECK (
  org_id = (
    SELECT p.org_id
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
    LIMIT 1
  )
);

-- SELECT: profiles.org_id based.
CREATE POLICY "patients_profile_select"
ON public.patients
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  org_id = (
    SELECT p.org_id
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
    LIMIT 1
  )
  AND deleted_at IS NULL
);

-- SELECT: service_role or JWT root org_id.
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

-- ALL (INSERT/UPDATE/DELETE): service_role override.
CREATE POLICY "patients_write"
ON public.patients
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);
