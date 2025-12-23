-- db/schema/trials/trials.sql
-- Purpose: Supabase table definition for `trials`.
-- Represents trial customers (deneme kullanıcıları) before becoming patients.
-- Includes: CREATE TABLE, constraints and RLS policies.
-- Source of truth: Supabase table editor / migrations.
--
-- Patch v2.1:
-- - Adds columns: note, deleted_at
-- - Adds index: (org_id, deleted_at)
-- - Updates SELECT RLS:
--   * staff: active-only (deleted_at IS NULL)
--   * admin: can see all (UI filter supports active/deleted/all)
-- - Keeps DELETE policy (hard delete allowed) per your choice.

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

-- Helper: current user's role (security definer to avoid RLS pitfalls)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- 2) Org-based SELECT (normal users)
--    staff => only active rows
--    admin => all rows
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
    OR public.current_user_role() = 'admin'
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

-- 4) Org-based UPDATE (normal users)
DROP POLICY IF EXISTS "trials_org_update" ON public.trials;
CREATE POLICY "trials_org_update"
ON public.trials
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
)
WITH CHECK (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);

-- 5) Org-based DELETE (normal users) – HARD DELETE allowed
DROP POLICY IF EXISTS "trials_org_delete" ON public.trials;
CREATE POLICY "trials_org_delete"
ON public.trials
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);
