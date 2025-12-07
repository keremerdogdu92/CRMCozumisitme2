-- db/schema/patients/patient_sale_breakdown.sql
-- Purpose: Supabase table definition for `patient_sale_breakdown`.
-- Includes: CREATE TABLE, constraints, and indexes for per-patient sale breakdown lines.
-- Source of truth: Supabase table editor / migrations.
-- NOTE: RLS policies will be added in a separate pass.

CREATE TABLE public.patient_sale_breakdown (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  method text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  note text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CONSTRAINT patient_sale_breakdown_pkey PRIMARY KEY (id),
  CONSTRAINT fk_patient_sale_breakdown_patient
    FOREIGN KEY (patient_id) REFERENCES public.patients (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_patient_sale_breakdown_patient
ON public.patient_sale_breakdown USING btree (patient_id)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_patient_sale_breakdown_org_patient
ON public.patient_sale_breakdown USING btree (org_id, patient_id)
TABLESPACE pg_default;

-- RLS POLICIES PLACEHOLDER
-- TODO: Paste RLS definitions for `public.patient_sale_breakdown` from Supabase.
--   ALTER TABLE public.patient_sale_breakdown ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY ... ;
