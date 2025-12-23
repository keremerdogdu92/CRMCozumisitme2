-- db/schema/trials/trials.sql
-- Purpose: Supabase table definition for `trials`.
-- Represents trial customers (deneme kullanıcıları) before becoming patients.
-- Includes: CREATE TABLE, constraints and RLS policies.
-- Source of truth: Supabase table editor / migrations.
--
-- Patch v2.1 (soft delete foundation + role-based visibility):
-- - Adds columns: note, deleted_at (soft delete marker).
-- - Adds index: (org_id, deleted_at) for fast active lists.
-- - Adds helper function public.is_current_user_admin() to check profiles.is_admin safely.
-- - Updates RLS:
--   * Staff: can only SELECT active rows (deleted_at IS NULL).
--   * Admin: can SELECT active + deleted; UI can filter active/deleted/all.
--   * UPDATE/DELETE: staff can only affect active rows; admin can affect all rows.
--
-- [TODO-SECURITY-BEFORE-PROD]
--   1) Standardize org resolution strategy across all tables:
--        - auth.jwt()->>'org_id' (used here)
--        - OR public.profiles.org_id
--   2) Ensure org_id claim exists in JWT for all clients.
--   3) Regression test:
--      - Single clinic scenario (CRUD)
--      - Multi-clinic scenario (org isolation)
--      - service_role access

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

-- Helpful index for "active list" and soft-delete filtering.
CREATE INDEX IF NOT EXISTS trials_org_deleted_at_idx
  ON public.trials (org_id, deleted_at);

-- ============================================================
-- ROLE HELPER
-- ============================================================
-- Requires: public.profiles has is_admin boolean (default false).
-- This function is SECURITY DEFINER to avoid RLS pitfalls when checking admin flag.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- ============================================================
-- RLS POLICIES FOR public.trials
-- ============================================================

ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;

-- 1) Backend full access (service_role)
DROP POLICY IF EXISTS "trials_service_full_access" ON public.trials;
CREATE POLICY "trials_service_full_access"
ON public.trials
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- 2) Org-based SELECT with role behavior:
--    - Staff: active-only (deleted_at IS NULL)
--    - Admin: active + deleted (UI can filter)
DROP POLICY IF EXISTS "trials_org_select" ON public.trials;
CREATE POLICY "trials_org_select"
ON public.trials
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
  AND (
    deleted_at IS NULL
    OR public.is_current_user_admin()
  )
);

-- 3) Org-based INSERT (normal users)
DROP POLICY IF EXISTS "trials_org_insert" ON public.trials;
CREATE POLICY "trials_org_insert"
ON public.trials
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);

-- 4) Org-based UPDATE:
--    - Staff: can only update active rows (deleted_at IS NULL)
--    - Admin: can update any row in org
DROP POLICY IF EXISTS "trials_org_update" ON public.trials;
CREATE POLICY "trials_org_update"
ON public.trials
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
  AND (
    deleted_at IS NULL
    OR public.is_current_user_admin()
  )
)
WITH CHECK (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);

-- 5) Org-based DELETE (hard delete):
--    - Staff: can only delete active rows
--    - Admin: can delete any row in org
-- NOTE: Your UI uses soft delete via deleted_at; keep this only if you still want hard delete capability.
DROP POLICY IF EXISTS "trials_org_delete" ON public.trials;
CREATE POLICY "trials_org_delete"
ON public.trials
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
  AND (
    deleted_at IS NULL
    OR public.is_current_user_admin()
  )
);
