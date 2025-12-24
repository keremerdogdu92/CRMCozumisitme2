-- DB/schema/patients/patient_devices.sql
-- Purpose: Definition and RLS policies for patient_devices table.
-- Links patients to their devices (current + legacy) at org scope.
--
-- v3.0.0 (2025-12-24):
-- - SECURITY: Replace JWT org_id claim usage with helper-based org isolation (no JWT trust).

------------------------------------------------------------
-- TABLE: public.patient_devices
------------------------------------------------------------

CREATE TABLE public.patient_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  device_id uuid NOT NULL,
  side text NULL,
  price numeric(12, 2) NULL,
  assigned_at timestamp with time zone NULL DEFAULT now(),
  unassigned_at timestamp with time zone NULL,
  archive_code text NOT NULL,

  CONSTRAINT patient_devices_pkey
    PRIMARY KEY (id),

  CONSTRAINT patient_devices_device_id_fkey
    FOREIGN KEY (device_id)
    REFERENCES public.devices (id) ON DELETE RESTRICT,

  CONSTRAINT patient_devices_org_id_fkey
    FOREIGN KEY (org_id)
    REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT patient_devices_patient_id_fkey
    FOREIGN KEY (patient_id)
    REFERENCES public.patients (id) ON DELETE CASCADE,

  CONSTRAINT patient_devices_side_check
    CHECK (side = ANY (ARRAY['left'::text, 'right'::text]))
) TABLESPACE pg_default;

------------------------------------------------------------
-- TRIGGERS
------------------------------------------------------------

-- Archive code generator (existing function in DB)
CREATE TRIGGER trg_patient_devices_archive
BEFORE INSERT ON public.patient_devices
FOR EACH ROW
EXECUTE FUNCTION public.trg_patient_devices_set_archive();

------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) (multi-org, no JWT trust)
------------------------------------------------------------

ALTER TABLE public.patient_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_devices_select ON public.patient_devices;
DROP POLICY IF EXISTS patient_devices_write ON public.patient_devices;

DROP POLICY IF EXISTS patient_devices_service_full_access ON public.patient_devices;
DROP POLICY IF EXISTS patient_devices_select_by_org ON public.patient_devices;
DROP POLICY IF EXISTS patient_devices_insert_by_org ON public.patient_devices;
DROP POLICY IF EXISTS patient_devices_update_by_org ON public.patient_devices;
DROP POLICY IF EXISTS patient_devices_delete_by_org ON public.patient_devices;

-- service_role bypass
CREATE POLICY patient_devices_service_full_access
ON public.patient_devices
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- SELECT
CREATE POLICY patient_devices_select_by_org
ON public.patient_devices
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- INSERT
CREATE POLICY patient_devices_insert_by_org
ON public.patient_devices
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- UPDATE
CREATE POLICY patient_devices_update_by_org
ON public.patient_devices
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
CREATE POLICY patient_devices_delete_by_org
ON public.patient_devices
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);
