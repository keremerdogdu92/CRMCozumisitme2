-- DB/schema/device_repairs.sql
-- Purpose: Supabase table definition for `public.device_repairs`.
-- Summary: Repairs workflow tracking per org, with status lifecycle and timeline timestamps.
-- Soft delete standard:
-- - deleted_at + deleted_by + delete_reason
-- - no hard delete for authenticated
--
-- v1.2.0 (2025-12-25):
-- - SOFT DELETE: add deleted_* columns + trigger stamp deleted_by.
-- - HARD DELETE: remove authenticated DELETE policy.

CREATE TABLE IF NOT EXISTS public.device_repairs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  device_id uuid NULL,
  patient_id uuid NULL,
  sent_at timestamptz NULL,
  returned_at timestamptz NULL,
  cost numeric NULL DEFAULT 0,
  note text NULL,
  meeting_id uuid NULL,
  inventory_item_id uuid NULL,
  status text NOT NULL DEFAULT 'created'::text,
  reason_note text NULL,
  cargo_company text NULL,
  cargo_tracking_no text NULL,
  shipped_at timestamptz NULL,
  returned_to_clinic_at timestamptz NULL,
  delivered_to_patient_at timestamptz NULL,
  expected_delivery_meeting_id uuid NULL,
  last_status_changed timestamptz NOT NULL DEFAULT now(),

  -- Soft delete
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT device_repairs_pkey PRIMARY KEY (id),
  CONSTRAINT device_repairs_status_check
    CHECK (status = ANY (ARRAY[
      'created'::text,
      'shipped'::text,
      'returned_waiting_meeting'::text,
      'scheduled'::text,
      'delivered'::text,
      'cancelled'::text
    ])),
  CONSTRAINT device_repairs_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,
  CONSTRAINT device_repairs_device_id_fkey
    FOREIGN KEY (device_id) REFERENCES public.devices (id) ON DELETE SET NULL,
  CONSTRAINT device_repairs_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients (id) ON DELETE SET NULL,
  CONSTRAINT device_repairs_meeting_id_fkey
    FOREIGN KEY (meeting_id) REFERENCES public.meetings (id) ON DELETE SET NULL,
  CONSTRAINT device_repairs_inventory_item_id_fkey
    FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items (id) ON DELETE SET NULL,
  CONSTRAINT device_repairs_expected_delivery_meeting_id_fkey
    FOREIGN KEY (expected_delivery_meeting_id) REFERENCES public.meetings (id) ON DELETE SET NULL,
  CONSTRAINT device_repairs_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS device_repairs_pkey
  ON public.device_repairs USING btree (id);

-- Active work queue index (optionally exclude soft-deleted rows)
DROP INDEX IF EXISTS device_repairs_active_idx;
CREATE INDEX IF NOT EXISTS device_repairs_active_idx
  ON public.device_repairs USING btree (org_id, status)
  WHERE (
    deleted_at IS NULL
    AND status = ANY (ARRAY[
      'created'::text,
      'shipped'::text,
      'returned_waiting_meeting'::text,
      'scheduled'::text
    ])
  );

CREATE INDEX IF NOT EXISTS device_repairs_inventory_idx
  ON public.device_repairs USING btree (inventory_item_id);

CREATE INDEX IF NOT EXISTS device_repairs_org_patient_idx
  ON public.device_repairs USING btree (org_id, patient_id);

CREATE INDEX IF NOT EXISTS device_repairs_deleted_at_idx
  ON public.device_repairs (deleted_at);

-- Soft delete trigger
DROP TRIGGER IF EXISTS trg_device_repairs_soft_delete_stamp ON public.device_repairs;

CREATE TRIGGER trg_device_repairs_soft_delete_stamp
BEFORE UPDATE OF deleted_at, deleted_by ON public.device_repairs
FOR EACH ROW
EXECUTE FUNCTION public.trg_soft_delete_set_deleted_by();

-- RLS
ALTER TABLE public.device_repairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_repairs_service_full_access ON public.device_repairs;
DROP POLICY IF EXISTS device_repairs_org_select ON public.device_repairs;
DROP POLICY IF EXISTS device_repairs_org_write ON public.device_repairs;

CREATE POLICY device_repairs_service_full_access
  ON public.device_repairs
  FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY device_repairs_org_select
  ON public.device_repairs
  FOR SELECT
  TO authenticated
  USING (
    (auth.role() = 'service_role'::text) OR (org_id = public.current_user_org_id())
  );

-- Write includes soft delete
CREATE POLICY device_repairs_org_write
  ON public.device_repairs
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
REVOKE ALL ON TABLE public.device_repairs FROM public;
GRANT SELECT, INSERT, UPDATE ON TABLE public.device_repairs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.device_repairs TO service_role;
