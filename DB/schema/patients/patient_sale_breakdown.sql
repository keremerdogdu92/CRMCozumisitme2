-- DB/schema/patients/patient_sale_breakdown.sql
-- Purpose: Supabase table definition for `public.patient_sale_breakdown`.
-- Summary: Captures sale split rows (method/amount) per patient+org.
-- Soft delete standard:
-- - deleted_at + deleted_by + delete_reason
-- - no hard delete for authenticated
--
-- v1.2.0 (2025-12-25):
-- - SOFT DELETE: add deleted_* columns + trigger stamp deleted_by.
-- - HARD DELETE: remove authenticated DELETE policy.

CREATE TABLE IF NOT EXISTS public.patient_sale_breakdown (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  method text NOT NULL,
  amount numeric NOT NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,

  -- Soft delete
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT patient_sale_breakdown_pkey PRIMARY KEY (id),
  CONSTRAINT fk_patient_sale_breakdown_patient
    FOREIGN KEY (patient_id) REFERENCES public.patients (id) ON DELETE CASCADE,
  CONSTRAINT patient_sale_breakdown_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS patient_sale_breakdown_pkey
  ON public.patient_sale_breakdown USING btree (id);

CREATE INDEX IF NOT EXISTS idx_patient_sale_breakdown_patient
  ON public.patient_sale_breakdown USING btree (patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_sale_breakdown_org_patient
  ON public.patient_sale_breakdown USING btree (org_id, patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_sale_breakdown_deleted_at
  ON public.patient_sale_breakdown USING btree (deleted_at);

-- Soft delete trigger
DROP TRIGGER IF EXISTS trg_patient_sale_breakdown_soft_delete_stamp ON public.patient_sale_breakdown;

CREATE TRIGGER trg_patient_sale_breakdown_soft_delete_stamp
BEFORE UPDATE OF deleted_at, deleted_by ON public.patient_sale_breakdown
FOR EACH ROW
EXECUTE FUNCTION public.trg_soft_delete_set_deleted_by();

-- RLS
ALTER TABLE public.patient_sale_breakdown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_sale_breakdown_service_full_access ON public.patient_sale_breakdown;
DROP POLICY IF EXISTS patient_sale_breakdown_select_by_org ON public.patient_sale_breakdown;
DROP POLICY IF EXISTS patient_sale_breakdown_insert_by_org ON public.patient_sale_breakdown;
DROP POLICY IF EXISTS patient_sale_breakdown_update_by_org ON public.patient_sale_breakdown;

CREATE POLICY patient_sale_breakdown_service_full_access
  ON public.patient_sale_breakdown
  FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY patient_sale_breakdown_select_by_org
  ON public.patient_sale_breakdown
  FOR SELECT
  TO authenticated
  USING (
    (auth.role() = 'service_role'::text) OR (org_id = public.current_user_org_id())
  );

CREATE POLICY patient_sale_breakdown_insert_by_org
  ON public.patient_sale_breakdown
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.role() = 'service_role'::text) OR (org_id = public.current_user_org_id())
  );

CREATE POLICY patient_sale_breakdown_update_by_org
  ON public.patient_sale_breakdown
  FOR UPDATE
  TO authenticated
  USING (
    (auth.role() = 'service_role'::text) OR (org_id = public.current_user_org_id())
  )
  WITH CHECK (
    (auth.role() = 'service_role'::text) OR (org_id = public.current_user_org_id())
  );

-- NO authenticated DELETE policy

-- Grants
REVOKE ALL ON TABLE public.patient_sale_breakdown FROM public;
GRANT SELECT, INSERT, UPDATE ON TABLE public.patient_sale_breakdown TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.patient_sale_breakdown TO service_role;
