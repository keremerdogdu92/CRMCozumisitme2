-- db/schema/patients/patient_installment_plans.sql
-- Purpose: Supabase table definition for `patient_installment_plans`.
-- Handles per-patient installment plans for a given org.
-- Includes: CREATE TABLE, constraints, indexes and RLS policies.
-- Enforces one active plan per patient per org.
-- Source of truth: Supabase table editor / migrations.
--
-- [SECURITY NOTES]
--   - Row visibility:
--       * All authenticated users of the same org can SELECT.
--       * All authenticated users of the same org can INSERT/UPDATE/DELETE
--         installment plans (staff + admin).
--       * `service_role` bypasses org checks and has full access.
--   - Multi-tenant isolation:
--       * org_id is enforced via profiles.org_id (auth.uid() → profiles.org_id).

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
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT patient_installment_plans_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS patient_installment_plans_org_patient_active_idx
ON public.patient_installment_plans USING btree (org_id, patient_id)
TABLESPACE pg_default
WHERE status = 'active'::text;

-- ============================================================
-- RLS POLICIES FOR public.patient_installment_plans
-- ============================================================

ALTER TABLE public.patient_installment_plans ENABLE ROW LEVEL SECURITY;

-- 1) Org-level SELECT for all authenticated users (staff + admin)
CREATE POLICY patient_installment_plans_org_select
ON public.patient_installment_plans
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id IN (
    SELECT p.org_id
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
  )
);

-- 2) Org-level WRITE (INSERT/UPDATE/DELETE) for all authenticated users
CREATE POLICY patient_installment_plans_org_write
ON public.patient_installment_plans
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id IN (
    SELECT p.org_id
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id IN (
    SELECT p.org_id
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
  )
);
