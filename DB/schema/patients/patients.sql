-- db/schema/patients/patients.sql
-- Purpose: Supabase table definition for `patients`.
-- Includes: CREATE TABLE, constraints, and triggers for patient rows.
-- Source of truth: Supabase table editor / migrations.
-- NOTE: RLS policies for `patients` will be added in a separate pass below.

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
    REFERENCES orgs (id) ON DELETE CASCADE,
  CONSTRAINT patients_reference_id_fkey FOREIGN KEY (reference_id)
    REFERENCES "references" (id) ON DELETE SET NULL,
  CONSTRAINT patients_payment_method_check CHECK (
    (
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
    )
  ),
  CONSTRAINT patients_satisfaction_10_check CHECK (
    satisfaction_10 >= 1 AND satisfaction_10 <= 10
  ),
  CONSTRAINT patients_sgk_flow CHECK (
    (
      (sgk_processed IS NOT TRUE OR sgk_docs_received IS TRUE)
      AND
      (sgk_docs_received IS NOT TRUE OR sgk_flag IS TRUE)
    )
  )
) TABLESPACE pg_default;

CREATE TRIGGER trg_patients_archive_code
BEFORE INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION set_patient_archive_code();

-- RLS POLICIES PLACEHOLDER
-- TODO: Export and paste the RLS policy definitions for `public.patients` here.
-- Example structure (do NOT invent policies, just paste from Supabase):
--   ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY ... ON public.patients USING (...);
