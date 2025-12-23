-- db/schema/core/profiles.sql
-- Purpose: Supabase table definition for `profiles`.
-- Stores per-user profile metadata such as org_id and role.
-- Includes: CREATE TABLE, constraints, FK to auth.users and RLS policies.
-- Source of truth: Supabase table editor / migrations.
--
-- Patch v2.1:
-- - Adds is_admin boolean (kept in sync with role).
-- - Adds trigger to keep is_admin consistent (role='admin' => is_admin=true).
-- - Keeps UI/authorization source-of-truth as `role` (admin/staff). is_admin is a derived convenience flag.
--
-- SECURITY NOTES
--  - Multi-tenant isolation:
--      * Users only see profiles that belong to the same org_id or their own id.
--  - Write access:
--      * INSERT/UPDATE/DELETE is restricted to service_role (backend).
--      * Frontend clients (authenticated users) cannot mutate profiles directly.
--  - If in the future you add fields like display_name, phone etc.
--    and want admins to edit them from the UI, you can:
--      * add an extra admin-only UPDATE policy, OR
--      * create RPCs with SECURITY DEFINER.

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
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,

  -- Role validation
  CONSTRAINT profiles_role_check CHECK (
    role = ANY (
      ARRAY[
        'admin'::text,
        'staff'::text
      ]
    )
  )
) TABLESPACE pg_default;

-- Backfill safeguard if the column already exists but old rows are inconsistent.
UPDATE public.profiles
SET is_admin = (role = 'admin')
WHERE is_admin IS DISTINCT FROM (role = 'admin');

-- ============================================================
-- ROLE -> is_admin SYNC (trigger)
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_profiles_is_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_admin := (NEW.role = 'admin');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_is_admin ON public.profiles;
CREATE TRIGGER trg_profiles_sync_is_admin
BEFORE INSERT OR UPDATE OF role
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profiles_is_admin();

-- ============================================================
-- RLS POLICIES FOR public.profiles
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1) SELECT for authenticated users:
--    - User can always see their own profile row (id = auth.uid()).
--    - Additionally, user can see profiles that share the same org_id
--      as carried in the JWT (root org_id or user_metadata.org_id).
DROP POLICY IF EXISTS profiles_select_self_and_org ON public.profiles;
CREATE POLICY profiles_select_self_and_org
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR org_id::text = coalesce(
    auth.jwt() ->> 'org_id',
    (auth.jwt() -> 'user_metadata' ->> 'org_id')
  )
);

-- 2) INSERT/UPDATE/DELETE only allowed for service_role (backend).
--    Frontend clients never modify profile rows directly.
DROP POLICY IF EXISTS profiles_service_write ON public.profiles;
CREATE POLICY profiles_service_write
ON public.profiles
AS PERMISSIVE
FOR INSERT, UPDATE, DELETE
TO public
USING (
  auth.role() = 'service_role'::text
)
WITH CHECK (
  auth.role() = 'service_role'::text
);
