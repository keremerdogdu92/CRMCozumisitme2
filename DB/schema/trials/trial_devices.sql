-- DB/schema/trials/trial_devices.sql
-- Purpose: Supabase table definition for `public.trial_devices`.
-- Multi-org standard:
-- - Org isolation via public.current_user_org_id().
--
-- v3.0.0:
-- - Replace profiles-subquery policies with helper-based policies.
-- - Keep hard delete for now.

CREATE TABLE IF NOT EXISTS public.trial_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  trial_id uuid NOT NULL,
  side text NULL,
  brand text NULL,
  model text NULL,
  quote_price numeric(12, 2) NULL,

  CONSTRAINT trial_devices_pkey PRIMARY KEY (id),

  CONSTRAINT trial_devices_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT trial_devices_trial_id_fkey
    FOREIGN KEY (trial_id) REFERENCES public.trials (id) ON DELETE CASCADE,

  CONSTRAINT trial_devices_side_check CHECK (
    side IS NULL
    OR side = ANY (ARRAY['left'::text, 'right'::text, 'both'::text])
  )
) TABLESPACE pg_default;

ALTER TABLE public.trial_devices ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies (names from your file + possible older ones)
DROP POLICY IF EXISTS "trial_devices_service_full_access" ON public.trial_devices;
DROP POLICY IF EXISTS "trial_devices_org_select" ON public.trial_devices;
DROP POLICY IF EXISTS "trial_devices_org_insert" ON public.trial_devices;
DROP POLICY IF EXISTS "trial_devices_org_update" ON public.trial_devices;
DROP POLICY IF EXISTS "trial_devices_org_delete" ON public.trial_devices;

-- Service role full access
CREATE POLICY "trial_devices_service_full_access"
ON public.trial_devices
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Org-scoped SELECT
CREATE POLICY "trial_devices_org_select"
ON public.trial_devices
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- Org-scoped INSERT
CREATE POLICY "trial_devices_org_insert"
ON public.trial_devices
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- Org-scoped UPDATE
CREATE POLICY "trial_devices_org_update"
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

-- Org-scoped DELETE (hard delete for now)
CREATE POLICY "trial_devices_org_delete"
ON public.trial_devices
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

REVOKE ALL ON TABLE public.trial_devices FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trial_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.trial_devices TO service_role;
