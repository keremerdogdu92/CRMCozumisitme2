-- db/schema/patients/device_repairs.sql
-- Purpose: Supabase table definition for `device_repairs`.
-- Handles repair workflow for devices linked to patients, meetings, and inventory.
-- Includes: CREATE TABLE, constraints, indexes and RLS policies.
-- Source of truth: Supabase table editor / migrations.
--
-- Multi-org standard:
-- - Org isolation via public.current_user_org_id() (never JWT claims).
-- - service_role bypass for backoffice/imports.
--
-- v3.0.0 (2025-12-24):
-- - SECURITY: Replace JWT-claim org isolation with helper-based policies.

CREATE TABLE IF NOT EXISTS public.device_repairs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  device_id uuid NULL,
  patient_id uuid NULL,
  sent_at timestamp with time zone NULL,
  returned_at timestamp with time zone NULL,
  cost numeric(12, 2) NULL DEFAULT 0,
  note text NULL,
  meeting_id uuid NULL,
  inventory_item_id uuid NULL,
  status text NOT NULL DEFAULT 'created'::text,
  reason_note text NULL,
  cargo_company text NULL,
  cargo_tracking_no text NULL,
  shipped_at timestamp with time zone NULL,
  returned_to_clinic_at timestamp with time zone NULL,
  delivered_to_patient_at timestamp with time zone NULL,
  expected_delivery_meeting_id uuid NULL,
  last_status_changed timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT device_repairs_pkey PRIMARY KEY (id),

  CONSTRAINT device_repairs_expected_delivery_meeting_id_fkey
    FOREIGN KEY (expected_delivery_meeting_id) REFERENCES public.meetings (id) ON DELETE SET NULL,

  CONSTRAINT device_repairs_inventory_item_id_fkey
    FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items (id) ON DELETE SET NULL,

  CONSTRAINT device_repairs_meeting_id_fkey
    FOREIGN KEY (meeting_id) REFERENCES public.meetings (id) ON DELETE SET NULL,

  CONSTRAINT device_repairs_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT device_repairs_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients (id) ON DELETE SET NULL,

  CONSTRAINT device_repairs_device_id_fkey
    FOREIGN KEY (device_id) REFERENCES public.devices (id) ON DELETE SET NULL,

  CONSTRAINT device_repairs_status_check CHECK (
    status = ANY (
      ARRAY[
        'created'::text,
        'shipped'::text,
        'returned_waiting_meeting'::text,
        'scheduled'::text,
        'delivered'::text,
        'cancelled'::text
      ]
    )
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS device_repairs_org_patient_idx
ON public.device_repairs USING btree (org_id, patient_id)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS device_repairs_inventory_idx
ON public.device_repairs USING btree (inventory_item_id)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS device_repairs_active_idx
ON public.device_repairs USING btree (org_id, status)
TABLESPACE pg_default
WHERE status = ANY (
  ARRAY[
    'created'::text,
    'shipped'::text,
    'returned_waiting_meeting'::text,
    'scheduled'::text
  ]
);

ALTER TABLE public.device_repairs ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies
DROP POLICY IF EXISTS device_repairs_org_select ON public.device_repairs;
DROP POLICY IF EXISTS device_repairs_org_write ON public.device_repairs;
DROP POLICY IF EXISTS device_repairs_service_full_access ON public.device_repairs;

-- service_role full access
CREATE POLICY device_repairs_service_full_access
ON public.device_repairs
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Org-level SELECT (staff + admin)
CREATE POLICY device_repairs_org_select
ON public.device_repairs
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- Org-level WRITE (INSERT/UPDATE/DELETE) (staff + admin)
CREATE POLICY device_repairs_org_write
ON public.device_repairs
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

REVOKE ALL ON TABLE public.device_repairs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.device_repairs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.device_repairs TO service_role;
