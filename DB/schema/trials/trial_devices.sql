-- DB/schema/trials/trial_devices.sql
-- Purpose: Supabase table definition for `public.trial_devices`.
-- Multi-org + soft delete standard:
-- - Org isolation via public.current_user_org_id()
-- - Soft delete via deleted_at + deleted_by + delete_reason
-- - Hard delete disabled for authenticated users (service_role only)
--
-- v3.1.0 (2025-12-25):
-- - SOFT DELETE: add deleted_* columns + trigger stamp deleted_by.
-- - HARD DELETE: remove authenticated DELETE policy.

CREATE TABLE IF NOT EXISTS public.trial_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  trial_id uuid NOT NULL,
  side text NULL,
  brand text NULL,
  model text NULL,
  quote_price numeric(12, 2) NULL,

  -- Soft delete
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT trial_devices_pkey PRIMARY KEY (id),

  CONSTRAINT trial_devices_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT trial_devices_trial_id_fkey
    FOREIGN KEY (trial_id) REFERENCES public.trials (id) ON DELETE CASCADE,

  CONSTRAINT trial_devices_side_check CHECK (
    side IS NULL
    OR side = ANY (ARRAY['left'::text, 'right'::text, 'both'::text])
  ),

  CONSTRAINT trial_devices_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES auth.users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS trial_devices_org_trial_idx
  ON public.trial_devices (org_id, trial_id);

CREATE INDEX IF NOT EXISTS trial_devices_deleted_at_idx
  ON public.trial_devices (deleted_at);

-- Trigger to stamp deleted_by on soft delete
DROP TRIGGER IF EXISTS trg_trial_devices_soft_delete_stamp ON public.trial_devices;

CREATE TRIGGER trg_trial_devices_soft_delete_stamp
BEFORE UPDATE OF deleted_at, deleted_by ON public.trial_devices
FOR EACH ROW
EXECUTE FUNCTION public.trg_soft_delete_set_deleted_by();

ALTER TABLE public.trial_devices ENABLE ROW LEVEL SECURITY;

-- Drop policies (deterministic)
DROP POLICY IF EXISTS trial_devices_service_full_access ON public.trial_devices;
DROP POLICY IF EXISTS trial_devices_org_select ON public.trial_devices;
DROP POLICY IF EXISTS trial_devices_org_insert ON public.trial_devices;
DROP POLICY IF EXISTS trial_devices_org_update ON public.trial_devices;
DROP POLICY IF EXISTS trial_devices_org_delete ON public.trial_devices;

-- service_role bypass
CREATE POLICY trial_devices_service_full_access
ON public.trial_devices
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Org-scoped SELECT
CREATE POLICY trial_devices_org_select
ON public.trial_devices
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- Org-scoped INSERT
CREATE POLICY trial_devices_org_insert
ON public.trial_devices
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- Org-scoped UPDATE (includes soft delete)
CREATE POLICY trial_devices_org_update
ON public.trial_devices
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- NO authenticated DELETE policy (hard delete disabled)

REVOKE ALL ON TABLE public.trial_devices FROM anon;
REVOKE ALL ON TABLE public.trial_devices FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.trial_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.trial_devices TO service_role;
