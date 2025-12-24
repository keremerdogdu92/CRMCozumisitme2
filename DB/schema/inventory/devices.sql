-- DB/schema/inventory/devices.sql
-- Purpose: Supabase table definition for `devices`.
-- Notes:
-- - Each row represents a physical device in inventory.
-- - Long-term patient ownership is tracked via public.patient_devices.
--
-- v3.0.0 (2025-12-24):
-- - SECURITY: Replace JWT org_id claim usage with helper-based org isolation (no JWT trust).

CREATE TABLE public.devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  brand text NULL,
  model text NULL,
  barcode text NULL,
  serial text NULL,
  status text NULL DEFAULT 'stock'::text,
  hold_patient_id uuid NULL,
  created_at timestamp with time zone NULL DEFAULT now(),

  CONSTRAINT devices_pkey PRIMARY KEY (id),
  CONSTRAINT devices_barcode_key UNIQUE (barcode),
  CONSTRAINT devices_serial_key UNIQUE (serial),

  CONSTRAINT devices_hold_patient_id_fkey FOREIGN KEY (hold_patient_id)
    REFERENCES public.patients (id) ON DELETE SET NULL,

  CONSTRAINT devices_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT devices_status_check CHECK (
    status = ANY (
      ARRAY['stock'::text, 'sold'::text, 'repair'::text]
    )
  )
) TABLESPACE pg_default;

-- ============================================================
-- RLS POLICIES FOR public.devices (multi-org, no JWT trust)
-- ============================================================

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS devices_select ON public.devices;
DROP POLICY IF EXISTS devices_write ON public.devices;

DROP POLICY IF EXISTS devices_service_full_access ON public.devices;
DROP POLICY IF EXISTS devices_select_by_org ON public.devices;
DROP POLICY IF EXISTS devices_insert_by_org ON public.devices;
DROP POLICY IF EXISTS devices_update_by_org ON public.devices;
DROP POLICY IF EXISTS devices_delete_by_org ON public.devices;

-- service_role bypass
CREATE POLICY devices_service_full_access
ON public.devices
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- SELECT
CREATE POLICY devices_select_by_org
ON public.devices
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- INSERT
CREATE POLICY devices_insert_by_org
ON public.devices
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- UPDATE
CREATE POLICY devices_update_by_org
ON public.devices
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

-- DELETE (hard delete allowed for now)
CREATE POLICY devices_delete_by_org
ON public.devices
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);
