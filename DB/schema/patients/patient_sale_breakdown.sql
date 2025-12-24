-- db/schema/patients/patient_sale_breakdown.sql
-- Purpose: Supabase table definition for `patient_sale_breakdown`.
-- Includes: CREATE TABLE, constraints, indexes and RLS policies for per-patient sale breakdown lines.
--
-- v2.0.0 (2025-12-24):
-- - SECURITY: Replace profiles subquery org check with public.current_user_org_id().
-- - ADD: explicit service_role safety policy.

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

ALTER TABLE public.patient_sale_breakdown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_sale_breakdown_select_by_org ON public.patient_sale_breakdown;
DROP POLICY IF EXISTS patient_sale_breakdown_insert_by_org ON public.patient_sale_breakdown;
DROP POLICY IF EXISTS patient_sale_breakdown_update_by_org ON public.patient_sale_breakdown;
DROP POLICY IF EXISTS patient_sale_breakdown_service_role_all ON public.patient_sale_breakdown;

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

CREATE POLICY patient_sale_breakdown_service_role_all
ON public.patient_sale_breakdown
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

REVOKE ALL ON TABLE public.patient_sale_breakdown FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.patient_sale_breakdown TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.patient_sale_breakdown TO service_role;
