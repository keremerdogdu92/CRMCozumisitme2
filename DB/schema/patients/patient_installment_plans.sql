-- DB/schema/patients/patient_installment_plans.sql
-- Purpose: Supabase table definition for `public.patient_installment_plans`.
-- Summary: Single active installment plan per (org_id, patient_id) enforced via partial unique index.
-- Soft delete standard:
-- - deleted_at + deleted_by + delete_reason
-- - no hard delete for authenticated
--
-- v1.2.0 (2025-12-25):
-- - SOFT DELETE: add deleted_* columns + trigger stamp deleted_by.
-- - INDEX: active unique index now ignores soft-deleted rows.
-- - HARD DELETE: remove authenticated DELETE policy.

CREATE TABLE IF NOT EXISTS public.patient_installment_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  sale_total numeric NOT NULL,
  upfront_paid numeric NOT NULL DEFAULT 0,
  installment_count integer NOT NULL,
  installment_amount numeric NOT NULL,
  first_due_date date NOT NULL,
  day_of_month integer NOT NULL,
  status text NOT NULL DEFAULT 'active'::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,

  -- Soft delete
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT patient_installment_plans_pkey PRIMARY KEY (id),
  CONSTRAINT patient_installment_plans_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,
  CONSTRAINT patient_installment_plans_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients (id) ON DELETE CASCADE,
  CONSTRAINT patient_installment_plans_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT patient_installment_plans_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS patient_installment_plans_pkey
  ON public.patient_installment_plans USING btree (id);

-- Single active plan per patient/org, excluding soft-deleted rows.
DROP INDEX IF EXISTS patient_installment_plans_org_patient_active_idx;
CREATE UNIQUE INDEX IF NOT EXISTS patient_installment_plans_org_patient_active_idx
  ON public.patient_installment_plans USING btree (org_id, patient_id)
  WHERE (status = 'active'::text AND deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS patient_installment_plans_deleted_at_idx
  ON public.patient_installment_plans (deleted_at);

-- Soft delete trigger
DROP TRIGGER IF EXISTS trg_patient_installment_plans_soft_delete_stamp ON public.patient_installment_plans;

CREATE TRIGGER trg_patient_installment_plans_soft_delete_stamp
BEFORE UPDATE OF deleted_at, deleted_by ON public.patient_installment_plans
FOR EACH ROW
EXECUTE FUNCTION public.trg_soft_delete_set_deleted_by();

-- RLS
ALTER TABLE public.patient_installment_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_installment_plans_service_full_access ON public.patient_installment_plans;
DROP POLICY IF EXISTS patient_installment_plans_org_select ON public.patient_installment_plans;
DROP POLICY IF EXISTS patient_installment_plans_org_write ON public.patient_installment_plans;

CREATE POLICY patient_installment_plans_service_full_access
  ON public.patient_installment_plans
  FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY patient_installment_plans_org_select
  ON public.patient_installment_plans
  FOR SELECT
  TO authenticated
  USING (
    (auth.role() = 'service_role'::text) OR (org_id = public.current_user_org_id())
  );

CREATE POLICY patient_installment_plans_org_write
  ON public.patient_installment_plans
  FOR INSERT, UPDATE
  TO authenticated
  USING (
    (auth.role() = 'service_role'::text) OR (org_id = public.current_user_org_id())
  )
  WITH CHECK (
    (auth.role() = 'service_role'::text) OR (org_id = public.current_user_org_id())
  );

-- NO authenticated DELETE policy

-- Grants
REVOKE ALL ON TABLE public.patient_installment_plans FROM public;
GRANT SELECT, INSERT, UPDATE ON TABLE public.patient_installment_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.patient_installment_plans TO service_role;
