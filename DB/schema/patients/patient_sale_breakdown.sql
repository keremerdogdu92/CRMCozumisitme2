-- db/schema/patients/patient_sale_breakdown.sql
-- Purpose: Supabase table definition for `patient_sale_breakdown`.
-- Includes: CREATE TABLE, constraints, indexes and RLS policies for per-patient sale breakdown lines.
-- Source of truth: Supabase table editor / migrations.
--
-- [TODO-SECURITY-BEFORE-PROD]
--   1) Confirm that org isolation for this table uses `public.profiles.org_id`
--      consistently with the rest of the system (patients, inventory, meetings).
--   2) Decide whether DELETE should be allowed on this table.
--      - Currently there is NO DELETE policy, so user-side deletes are blocked.
--      - If you add DELETE later, mirror the same org_id filter used below.
--   3) Decide whether `service_role` should bypass RLS here.
--      - Right now there is no explicit `auth.role() = 'service_role'` exception.
--      - If backend jobs must see all orgs, add a dedicated policy for that case.

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

-- ============================================================
-- RLS POLICIES FOR public.patient_sale_breakdown
-- Exported / aligned with Supabase UI configuration.
-- ============================================================

ALTER TABLE public.patient_sale_breakdown ENABLE ROW LEVEL SECURITY;

-- SELECT: only rows belonging to the current user's org
CREATE POLICY patient_sale_breakdown_select_by_org
ON public.patient_sale_breakdown
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = patient_sale_breakdown.org_id
  )
);

-- INSERT: user can only insert rows for their own org
CREATE POLICY patient_sale_breakdown_insert_by_org
ON public.patient_sale_breakdown
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = patient_sale_breakdown.org_id
  )
);

-- UPDATE: user can only read/update rows for their own org
CREATE POLICY patient_sale_breakdown_update_by_org
ON public.patient_sale_breakdown
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = patient_sale_breakdown.org_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = patient_sale_breakdown.org_id
  )
);

-- NOTE: No DELETE policy is defined.
--       As a result, regular users cannot delete rows from this table.
--       If delete support is required later, add a DELETE policy that
--       enforces the same org_id constraint as above.
