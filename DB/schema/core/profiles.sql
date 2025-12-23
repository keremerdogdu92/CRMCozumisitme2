-- db/schema/core/profiles.sql
-- Purpose: Supabase table definition for `profiles`.
-- Stores per-user profile metadata such as org_id and role.
-- Includes: CREATE TABLE, constraints, FK to auth.users and RLS policies.
-- Source of truth: Supabase table editor / live DB schema.
--
-- Patch v2.2:
-- - Aligns with live DB:
--   * Removes role->is_admin trigger/function (not present in DB).
--   * Removes backfill UPDATE (not present in DB).
--   * Adds missing policy: profiles_write (org-scoped write).
--   * Makes profiles_service_write policy FOR ALL (matches pg_policies cmd=ALL).
--
-- SECURITY NOTES
--  - Multi-tenant isolation:
--      * Users can read their own profile row OR profiles within their org (from JWT).
--  - Write access:
--      * Service role always allowed.
--      * Additionally, org-scoped writes are allowed via profiles_write policy (matches DB).
--    (If you want stricter behavior later, remove/adjust profiles_write in DB + repo.)

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  org_id uuid NOT NULL,
  role text NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  is_admin boolean NOT NULL DEFAULT false,

  CONSTRAINT profiles_pkey PRIMARY KEY (id),

  -- Link profile to Supabase auth user
  CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE,

  -- Organization relation
  CONSTRAINT profiles_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES orgs (id) ON DELETE CASCADE,

  -- Role validation
  CONSTRAINT profiles_role_check CHECK (
    role = ANY (ARRAY['admin'::text, 'staff'::text])
  )
) TABLESPACE pg_default;

-- ============================================================
-- RLS POLICIES FOR public.profiles (aligned with pg_policies)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1) SELECT for authenticated users:
--    - User can always see their own profile row (id = auth.uid()).
--    - Additionally, user can see profiles that share the same org_id
--      as carried in the JWT (org_id or user_metadata.org_id).
DROP POLICY IF EXISTS profiles_select_self_and_org ON public.profiles;
CREATE POLICY profiles_select_self_and_org
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (id = auth.uid())
  OR ((org_id)::text = COALESCE(
    (auth.jwt() ->> 'org_id'::text),
    ((auth.jwt() -> 'user_metadata'::text) ->> 'org_id'::text)
  ))
);

-- 2) Service role write access (matches DB: cmd=ALL, roles={public})
DROP POLICY IF EXISTS profiles_service_write ON public.profiles;
CREATE POLICY profiles_service_write
ON public.profiles
AS PERMISSIVE
FOR ALL
TO public
USING (
  auth.role() = 'service_role'::text
)
WITH CHECK (
  auth.role() = 'service_role'::text
);

-- 3) Org-scoped write access (matches DB: cmd=ALL, roles={public})
DROP POLICY IF EXISTS profiles_write ON public.profiles;
CREATE POLICY profiles_write
ON public.profiles
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
