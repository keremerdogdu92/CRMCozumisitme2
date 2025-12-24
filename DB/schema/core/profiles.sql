-- db/schema/core/profiles.sql
-- Purpose: Supabase table definition for `public.profiles`.
-- Stores per-user profile metadata such as org_id, role, and is_admin.
-- Includes: CREATE TABLE, constraints, indexes, RLS + policies, grants,
--           and auth.users -> profiles bootstrap function/trigger.
--
-- Multi-org standard:
-- - Never trust org_id from JWT claims in RLS.
-- - Resolve org_id via profiles.id = auth.uid() using SECURITY DEFINER helper(s).
-- - Prevent client-side changes to org_id/role/is_admin (protected fields) via trigger.
--
-- v3.0.0:
-- - Add helper functions: current_user_org_id(), current_user_role()
-- - Replace JWT-based policies with helper-based policies
-- - Add trigger to protect org_id/role/is_admin from non-service updates

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  org_id uuid NOT NULL,
  role text NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  is_admin boolean NOT NULL DEFAULT false,

  CONSTRAINT profiles_pkey PRIMARY KEY (id),

  CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE,

  CONSTRAINT profiles_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT profiles_role_check CHECK (
    role = ANY (ARRAY['admin'::text, 'staff'::text])
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey
  ON public.profiles USING btree (id);

-- ============================================================
-- HELPERS (RLS foundation)
-- ============================================================

-- Resolve the caller's org_id via profiles.
-- SECURITY DEFINER is required so RLS checks don't deadlock on profiles access.
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.org_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies (repo should be deterministic)
DROP POLICY IF EXISTS profiles_select_self_and_org ON public.profiles;
DROP POLICY IF EXISTS profiles_service_write ON public.profiles;
DROP POLICY IF EXISTS profiles_write ON public.profiles;

-- SELECT:
-- - User can always read own profile
-- - Users can read other profiles in their org (needed for admin/staff listings; safe because org-scoped)
CREATE POLICY profiles_select_self_and_org
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (id = auth.uid())
  OR (org_id = public.current_user_org_id())
);

-- INSERT:
-- Profiles rows are created only by the auth.users trigger (runs as SECURITY DEFINER)
-- and service_role (admin endpoints).
CREATE POLICY profiles_insert_service_only
ON public.profiles
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (
  auth.role() = 'service_role'::text
);

-- UPDATE:
-- Allow a user to update their own row (e.g., name/phone if you add later),
-- but protected fields are enforced by a trigger below.
CREATE POLICY profiles_update_self
ON public.profiles
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- DELETE:
CREATE POLICY profiles_delete_service_only
ON public.profiles
AS PERMISSIVE
FOR DELETE
TO public
USING (
  auth.role() = 'service_role'::text
);

-- ============================================================
-- PROTECT PROTECTED FIELDS (org_id / role / is_admin)
-- ============================================================

CREATE OR REPLACE FUNCTION public.profiles_protect_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- service_role can do anything
  IF auth.role() = 'service_role'::text THEN
    RETURN NEW;
  END IF;

  -- Block changes to protected fields for non-service callers
  IF (NEW.org_id IS DISTINCT FROM OLD.org_id) THEN
    RAISE EXCEPTION 'profiles.org_id is immutable for non-service updates';
  END IF;

  IF (NEW.role IS DISTINCT FROM OLD.role) THEN
    RAISE EXCEPTION 'profiles.role is immutable for non-service updates';
  END IF;

  IF (NEW.is_admin IS DISTINCT FROM OLD.is_admin) THEN
    RAISE EXCEPTION 'profiles.is_admin is immutable for non-service updates';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_profiles_protect_fields ON public.profiles;

CREATE TRIGGER trg_profiles_protect_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_protect_fields();

-- ============================================================
-- AUTH → PROFILES BOOTSTRAP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_org_id uuid;
  v_role text;
BEGIN
  -- org_id must come from user_metadata
  v_org_id := nullif(new.raw_user_meta_data->>'org_id', '')::uuid;

  -- role defaults to staff
  v_role := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'staff');

  IF v_role NOT IN ('admin','staff') THEN
    v_role := 'staff';
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'org_id is required in user_metadata to create profile';
  END IF;

  INSERT INTO public.profiles (id, org_id, role, is_admin)
  VALUES (new.id, v_org_id, v_role, (v_role = 'admin'))
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_create_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

-- ============================================================
-- GRANTS (RLS still applies)
-- ============================================================

-- IMPORTANT:
-- - Do NOT grant anon write access. Keep minimal.
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM authenticated;

GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE ON TABLE public.profiles TO authenticated; -- self-only via RLS
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.profiles TO service_role;
