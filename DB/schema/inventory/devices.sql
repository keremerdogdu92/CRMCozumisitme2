-- db/schema/inventory/devices.sql
-- Purpose: Supabase table definition for `devices`.
-- Includes: CREATE TABLE, constraints and RLS policies for device rows.
-- Source of truth: Supabase table editor / migrations.
--
-- Notes:
--   - Each row represents a physical device in inventory.
--   - Long-term hasta sahipliği `public.patient_devices` üzerinden takip edilir.
--   - `status` alanı stok akışını (stock / sold / repair) izlemek için kullanılır.
--   - `hold_patient_id` kısa süreli tutma/blokaj senaryoları içindir.

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
-- RLS POLICIES FOR public.devices
-- Exported from Supabase UI (policies tab).
-- ============================================================

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- 1) Public SELECT: service_role bypass OR JWT root claim org_id match.
CREATE POLICY "devices_select"
ON public.devices
AS PERMISSIVE
FOR SELECT
TO public
USING (
  (auth.role() = 'service_role'::text)
  OR ((org_id)::text = (auth.jwt() ->> 'org_id'::text))
);

-- 2) Public ALL (INSERT/UPDATE/DELETE): service_role or JWT root claim org_id match.
CREATE POLICY "devices_write"
ON public.devices
AS PERMISSIVE
FOR ALL
TO public
USING (
  (auth.role() = 'service_role'::text)
  OR ((org_id)::text = (auth.jwt() ->> 'org_id'::text))
)
WITH CHECK (
  (auth.role() = 'service_role'::text)
  OR ((org_id)::text = (auth.jwt() ->> 'org_id'::text))
);
