-- DB/schema/trials/trials.sql
-- Purpose: Supabase table definition for `public.trials`.
-- Multi-org standard:
-- - Org isolation via public.current_user_org_id() (never JWT claims).
-- - Staff SELECT: active-only (deleted_at IS NULL).
-- - Admin SELECT: can see all (UI filter supports active/deleted/all).
-- - INSERT/UPDATE/DELETE: allowed within org (same as existing app behavior).
--
-- v3.0.0:
-- - REMOVE: JWT org_id usage.
-- - REMOVE: local current_user_role() re-definition (must be defined centrally in core/profiles.sql).
-- - ADD: deterministic policy set.

CREATE TABLE IF NOT EXISTS public.trials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  full_name text NULL,
  phone text NULL,
  first_meet_at timestamp with time zone NULL,
  next_meet_at timestamp with time zone NULL,
  reference_id uuid NULL,
  note text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,

  CONSTRAINT trials_pkey PRIMARY KEY (id),
  CONSTRAINT trials_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS trials_org_deleted_at_idx
  ON public.trials (org_id, deleted_at);

ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies
DROP POLICY IF EXISTS "trials_service_full_access" ON public.trials;
DROP POLICY IF EXISTS "trials_org_select" ON public.trials;
DROP POLICY IF EXISTS "trials_org_insert" ON public.trials;
DROP POLICY IF EXISTS "trials_org_update" ON public.trials;
DROP POLICY IF EXISTS "trials_org_delete" ON public.trials;

-- Service role full access (optional but keeps parity with other tables)
CREATE POLICY "trials_service_full_access"
ON public.trials
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- SELECT: staff active-only; admin all (both org-scoped)
CREATE POLICY "trials_org_select"
ON public.trials
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (deleted_at IS NULL OR public.current_user_role() = 'admin')
  )
);

-- INSERT: within org
CREATE POLICY "trials_org_insert"
ON public.trials
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- UPDATE: within org
CREATE POLICY "trials_org_update"
ON public.trials
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

-- DELETE: hard delete allowed within org (your current choice)
CREATE POLICY "trials_org_delete"
ON public.trials
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

REVOKE ALL ON TABLE public.trials FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.trials TO service_role;
