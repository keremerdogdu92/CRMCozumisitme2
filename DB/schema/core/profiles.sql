-- db/schema/core/profiles.sql
-- Purpose: Supabase table definition for `profiles`.
-- Stores per-user profile metadata such as org_id and role.
-- Includes: CREATE TABLE, constraints, FK to auth.users.
-- Source of truth: Supabase table editor / migrations.
-- NOTE: RLS policies will be added later (Supabase manages default policies).

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  org_id uuid NOT NULL,
  role text NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),

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

-- RLS POLICIES PLACEHOLDER
-- TODO: Paste actual RLS policies exported from Supabase for `public.profiles`.
--   ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY ...;
