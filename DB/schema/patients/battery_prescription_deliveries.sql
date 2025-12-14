-- DB/schema/patients/battery_prescription_deliveries.sql
-- Purpose: Track SGK battery prescription deliveries per patient.
-- This is NOT an accessory sale; it's an SGK reimbursement event.
-- Includes: CREATE TABLE, indexes and RLS policies.
-- Source of truth: Supabase table editor / migrations.

CREATE TABLE public.battery_prescription_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  patient_id uuid NOT NULL,

  delivered_at timestamptz NOT NULL DEFAULT now(),
  prescription_no text NULL,

  -- Common battery sizes for hearing aids
  -- Keep as text to avoid overfitting, validate at UI level.
  battery_type text NOT NULL,

  -- Quantities: you can use any/all of these depending on how you count.
  qty_boxes integer NULL,
  qty_packs integer NULL,
  qty_units integer NULL,

  -- Expected SGK reimbursement for this delivery (TRY)
  sgk_expected_amount numeric(10, 2) NULL,

  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

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
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS battery_prescription_deliveries_by_patient
ON public.battery_prescription_deliveries (patient_id, delivered_at DESC);

CREATE INDEX IF NOT EXISTS battery_prescription_deliveries_by_org
ON public.battery_prescription_deliveries (org_id, delivered_at DESC);

-- Useful for common filters: org + patient timeline
CREATE INDEX IF NOT EXISTS battery_prescription_deliveries_by_org_patient
ON public.battery_prescription_deliveries (org_id, patient_id, delivered_at DESC);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.battery_prescription_deliveries ENABLE ROW LEVEL SECURITY;

-- Read: same-org staff/admin
CREATE POLICY "battery_prescription_deliveries_select_by_org"
ON public.battery_prescription_deliveries
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = battery_prescription_deliveries.org_id
  )
);

-- Write: same-org staff/admin
CREATE POLICY "battery_prescription_deliveries_write_by_org"
ON public.battery_prescription_deliveries
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = battery_prescription_deliveries.org_id
  )
);

CREATE POLICY "battery_prescription_deliveries_update_by_org"
ON public.battery_prescription_deliveries
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = battery_prescription_deliveries.org_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = battery_prescription_deliveries.org_id
  )
);

CREATE POLICY "battery_prescription_deliveries_delete_by_org"
ON public.battery_prescription_deliveries
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = battery_prescription_deliveries.org_id
  )
);
