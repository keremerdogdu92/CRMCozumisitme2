-- DB/schema/patients/battery_prescription_deliveries.sql
-- Purpose: Track SGK battery prescription deliveries per patient.
-- Soft delete standard:
-- - deleted_at + deleted_by + delete_reason
-- - no hard delete for authenticated
--
-- v1.1.0 (2025-12-25):
-- - SOFT DELETE: add deleted_* columns + trigger stamp deleted_by.
-- - SECURITY: helper-based org isolation (no profiles subquery).
-- - HARD DELETE: remove authenticated DELETE policy.
-- - TRIGGER: mark patient as battery patient only for non-deleted deliveries + backfill ignores deleted.

CREATE TABLE IF NOT EXISTS public.battery_prescription_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  patient_id uuid NOT NULL,

  delivered_at timestamptz NOT NULL DEFAULT now(),
  prescription_no text NULL,

  -- Keep as text, validate at UI level.
  battery_type text NOT NULL,

  qty_boxes integer NULL,
  qty_packs integer NULL,
  qty_units integer NULL,

  sgk_expected_amount numeric(10, 2) NULL,

  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Soft delete
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT battery_prescription_deliveries_pkey PRIMARY KEY (id),

  CONSTRAINT battery_prescription_deliveries_org_id_fkey
    FOREIGN KEY (org_id)
    REFERENCES public.orgs (id)
    ON DELETE CASCADE,

  CONSTRAINT battery_prescription_deliveries_patient_id_fkey
    FOREIGN KEY (patient_id)
    REFERENCES public.patients (id)
    ON DELETE CASCADE,

  CONSTRAINT battery_prescription_qty_non_negative CHECK (
    (qty_boxes IS NULL OR qty_boxes >= 0)
    AND (qty_packs IS NULL OR qty_packs >= 0)
    AND (qty_units IS NULL OR qty_units >= 0)
  ),

  CONSTRAINT battery_prescription_battery_type_not_blank CHECK (
    length(trim(battery_type)) > 0
  ),

  CONSTRAINT battery_prescription_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES auth.users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS battery_prescription_deliveries_by_patient
ON public.battery_prescription_deliveries (patient_id, delivered_at DESC);

CREATE INDEX IF NOT EXISTS battery_prescription_deliveries_by_org
ON public.battery_prescription_deliveries (org_id, delivered_at DESC);

CREATE INDEX IF NOT EXISTS battery_prescription_deliveries_by_org_patient
ON public.battery_prescription_deliveries (org_id, patient_id, delivered_at DESC);

CREATE INDEX IF NOT EXISTS battery_prescription_deliveries_deleted_at_idx
ON public.battery_prescription_deliveries (deleted_at);

-- Soft delete trigger
DROP TRIGGER IF EXISTS trg_battery_prescription_deliveries_soft_delete_stamp
ON public.battery_prescription_deliveries;

CREATE TRIGGER trg_battery_prescription_deliveries_soft_delete_stamp
BEFORE UPDATE OF deleted_at, deleted_by ON public.battery_prescription_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.trg_soft_delete_set_deleted_by();

-- ============================================================
-- RLS (helper-based, consistent with multi-org standard)
-- ============================================================

ALTER TABLE public.battery_prescription_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS battery_prescription_deliveries_service_full_access ON public.battery_prescription_deliveries;
DROP POLICY IF EXISTS battery_prescription_deliveries_select_by_org ON public.battery_prescription_deliveries;
DROP POLICY IF EXISTS battery_prescription_deliveries_write_by_org ON public.battery_prescription_deliveries;

CREATE POLICY battery_prescription_deliveries_service_full_access
ON public.battery_prescription_deliveries
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY battery_prescription_deliveries_select_by_org
ON public.battery_prescription_deliveries
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY battery_prescription_deliveries_write_by_org
ON public.battery_prescription_deliveries
AS PERMISSIVE
FOR INSERT, UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- NO authenticated DELETE policy

REVOKE ALL ON TABLE public.battery_prescription_deliveries FROM public;
GRANT SELECT, INSERT, UPDATE ON TABLE public.battery_prescription_deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.battery_prescription_deliveries TO service_role;

-- ============================================================
-- TRIGGER: mark patients.is_battery_patient = true on delivery
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_patient_as_battery_patient()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only mark patient if the delivery is not soft-deleted.
  IF NEW.deleted_at IS NULL THEN
    UPDATE public.patients p
    SET is_battery_patient = TRUE
    WHERE p.id = NEW.patient_id
      AND p.org_id = NEW.org_id
      AND p.is_battery_patient IS DISTINCT FROM TRUE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_battery_delivery_mark_patient
ON public.battery_prescription_deliveries;

CREATE TRIGGER trg_battery_delivery_mark_patient
AFTER INSERT OR UPDATE OF patient_id, org_id, deleted_at
ON public.battery_prescription_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.mark_patient_as_battery_patient();

-- Backfill: consider only non-deleted deliveries
UPDATE public.patients p
SET is_battery_patient = TRUE
WHERE p.is_battery_patient IS DISTINCT FROM TRUE
  AND EXISTS (
    SELECT 1
    FROM public.battery_prescription_deliveries b
    WHERE b.patient_id = p.id
      AND b.org_id = p.org_id
      AND b.deleted_at IS NULL
  );
