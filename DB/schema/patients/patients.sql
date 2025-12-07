-- db/schema/patients/patients.sql
-- Purpose: Supabase table definition for `patients`.
-- Includes: CREATE TABLE, constraints, triggers and RLS policies for patient rows.
-- Source of truth: Supabase table editor / migrations.
--
-- [TODO-SECURITY-BEFORE-PROD]
--   1) Remove or disable the "patients_debug_allow_all" policy.
--      - It currently allows all authenticated users to see ALL patients (USING true).
--   2) Decide a single org resolution strategy and simplify policies:
--      - EITHER use JWT root claim org_id (auth.jwt()->>'org_id')
--      - OR use JWT user_metadata.org_id
--      - OR use profiles.org_id
--      and then delete redundant policies so SELECT/INSERT/UPDATE rules are not duplicated.
--   3) Document the expected JWT claims (org_id, user_metadata.org_id, role)
--      so that future clients / services send a consistent token shape.
--   4) Re-run a full regression test for:
--      - Single-org usage
--      - Multi-org separation (users from org A cannot see/edit org B’s patients)
--      - Service role (backend) access to all orgs.
--   5) Decide and document the deletion model for patients:
--      - Şu anda `patients_write` FOR ALL DELETE’i de kapsıyor.
--      - Hard delete mi yapacağız, yoksa ileride soft-delete kolonu (deleted_at) mi eklenecek?
--      - `archive_code` üretim kuralı ile çelişmeyecek şekilde tasarla (kod çakışması olmasın).

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
  )
) TABLESPACE pg_default;

CREATE TRIGGER trg_patients_archive_code
BEFORE INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION set_patient_archive_code();

-- ============================================================
-- RLS POLICIES FOR public.patients
-- Exported from Supabase UI (policies tab).
-- ============================================================

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- 1) Debug policy: allow all rows for authenticated users (SELECT only).
--    [TODO-SECURITY-BEFORE-PROD] Remove or disable this policy.
CREATE POLICY "patients_debug_allow_all"
ON public.patients
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);

-- 2) Authenticated INSERT: org_id must match JWT user_metadata.org_id.
CREATE POLICY "patients_org_insert"
ON public.patients
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id)::text = ((auth.jwt() -> 'user_metadata'::text) ->> 'org_id'::text)
);

-- 3) Authenticated SELECT: org_id must match JWT user_metadata.org_id.
CREATE POLICY "patients_org_select"
ON public.patients
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (org_id)::text = ((auth.jwt() -> 'user_metadata'::text) ->> 'org_id'::text)
);

-- 4) Authenticated UPDATE: same org rule for both read and write sides.
CREATE POLICY "patients_org_update"
ON public.patients
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  (org_id)::text = ((auth.jwt() -> 'user_metadata'::text) ->> 'org_id'::text)
)
WITH CHECK (
  (org_id)::text = ((auth.jwt() -> 'user_metadata'::text) ->> 'org_id'::text)
);

-- 5) Authenticated SELECT: org_id resolved via profiles.org_id.
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
);

-- 6) Public SELECT: service_role bypass OR JWT root claim org_id match.
CREATE POLICY "patients_select"
ON public.patients
AS PERMISSIVE
FOR SELECT
TO public
USING (
  auth.role() = 'service_role'::text
  OR (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);

-- 7) Public ALL (INSERT/UPDATE/DELETE): service_role or JWT root claim org_id match.
CREATE POLICY "patients_write"
ON public.patients
AS PERMISSIVE
FOR ALL
TO public
USING (
  auth.role() = 'service_role'::text
  OR (org_id)::text = (auth.jwt() ->> 'org_id'::text)
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);
