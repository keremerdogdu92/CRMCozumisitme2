-- db/schema/patients/patient_installment_plans.sql
-- Purpose: Supabase table definition for `patient_installment_plans`.
-- Includes: CREATE TABLE, constraints, and indexes for installment plans.
-- Enforces one active plan per patient per org.
-- Source of truth: Supabase table editor / migrations.
-- NOTE: RLS policies will be added in a separate pass.

CREATE TABLE public.patient_installment_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  sale_total numeric(12, 2) NOT NULL,
  upfront_paid numeric(12, 2) NOT NULL DEFAULT 0,
  installment_count integer NOT NULL,
  installment_amount numeric(12, 2) NOT NULL,
  first_due_date date NOT NULL,
  day_of_month integer NOT NULL,
  status text NOT NULL DEFAULT 'active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CONSTRAINT patient_installment_plans_pkey PRIMARY KEY (id),
  CONSTRAINT patient_installment_plans_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT patient_installment_plans_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES orgs (id) ON DELETE CASCADE,
  CONSTRAINT patient_installment_plans_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS patient_installment_plans_org_patient_active_idx
ON public.patient_installment_plans USING btree (org_id, patient_id)
TABLESPACE pg_default
WHERE status = 'active'::text;

-- RLS POLICIES PLACEHOLDER
-- TODO: Paste RLS definitions for `public.patient_installment_plans` from Supabase UI.
-- Example:
--   ALTER TABLE public.patient_installment_plans ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY ...;
