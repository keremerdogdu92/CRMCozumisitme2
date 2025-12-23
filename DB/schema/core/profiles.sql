-- db/schema/core/profiles.sql
-- Purpose: Supabase table definition for `public.profiles`.
-- Stores per-user profile metadata such as org_id, role, and is_admin.
-- Includes: CREATE TABLE, constraints, indexes, RLS + policies, grants,
--           and auth.users -> profiles bootstrap function/trigger.
-- Source of truth: Supabase live DB schema (verified via SQL Editor).
--
-- Patch v2.4 (DB-aligned, snapshot-style):
-- - Matches live columns, defaults, constraints.
-- - Matches live RLS policies.
-- - Matches live handle_new_user_profile() function.
-- - Matches live auth.users trigger:
--     on_auth_user_created_create_profile
-- - No duplicate-trigger cleanup logic (already cleaned in DB).

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

-- Primary key index (as in DB)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey
  ON public.profiles USING btree (id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1) SELECT: self OR same-org (JWT org_id fallback to user_metadata.org_id)
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

-- 2) Service role: full access
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

-- 3) Org-scoped writes
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

-- ============================================================
-- AUTH → PROFILES BOOTSTRAP
-- ============================================================

-- Function: public.handle_new_user_profile()
-- Called by auth.users trigger after INSERT.
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_org_id uuid;
  v_role text;
begin
  -- org_id must come from user_metadata
  v_org_id := nullif(new.raw_user_meta_data->>'org_id', '')::uuid;

  -- role defaults to staff
  v_role := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'staff');

  if v_role not in ('admin','staff') then
    v_role := 'staff';
  end if;

  if v_org_id is null then
    raise exception 'org_id is required in user_metadata to create profile';
  end if;

  insert into public.profiles (id, org_id, role, is_admin)
  values (new.id, v_org_id, v_role, (v_role = 'admin'))
  on conflict (id) do nothing;

  return new;
end;
$function$;

-- ============================================================
-- TRIGGER (live DB)
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_create_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

-- ============================================================
-- GRANTS (as in DB; RLS still applies)
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.profiles TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.profiles TO service_role;
