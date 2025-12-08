-- db/schema/patients/patient_devices.sql
-- Purpose: Stores installed hearing devices per patient (legacy + new).
-- Legacy imports from patients_legacy_devices_import_rows are written here.

CREATE TABLE public.patient_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  ear_side text NOT NULL, -- 'R','L','Tek','Çift'
  serial_no text NULL,
  sold_at date NULL,
  -- Optional historical price; not used for new sales calculation.
  legacy_price_total numeric NULL,

  is_legacy boolean NOT NULL DEFAULT true,
  legacy_import_job_id uuid NULL,
  legacy_row_id uuid NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT patient_devices_pkey PRIMARY KEY (id),

  CONSTRAINT patient_devices_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT patient_devices_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients (id) ON DELETE CASCADE,

  CONSTRAINT patient_devices_import_job_fkey
    FOREIGN KEY (legacy_import_job_id) REFERENCES public.import_jobs (id) ON DELETE SET NULL,

  CONSTRAINT patient_devices_legacy_row_fkey
    FOREIGN KEY (legacy_row_id) REFERENCES public.patients_legacy_devices_import_rows (id) ON DELETE SET NULL,

  CONSTRAINT patient_devices_ear_side_check CHECK (
    ear_side = ANY (ARRAY['R','L','Tek','Çift'])
  )
);

-- =======================================
-- RLS
-- =======================================

ALTER TABLE public.patient_devices ENABLE ROW LEVEL SECURITY;

-- service_role full access
CREATE POLICY patient_devices_service_full_access
ON public.patient_devices
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- org-level SELECT
CREATE POLICY patient_devices_org_select
ON public.patient_devices
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = patient_devices.org_id
  )
);

-- org-level INSERT
CREATE POLICY patient_devices_org_insert
ON public.patient_devices
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = patient_devices.org_id
  )
);

-- org-level UPDATE
CREATE POLICY patient_devices_org_update
ON public.patient_devices
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = patient_devices.org_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = patient_devices.org_id
  )
);

-- org-level DELETE (ileride ihtiyaç olursa)
CREATE POLICY patient_devices_org_delete
ON public.patient_devices
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = patient_devices.org_id
  )
);
