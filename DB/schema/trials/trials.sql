-- db/schema/trials/trials.sql
-- Purpose: Supabase table definition for `trials`.
-- Represents trial customers (deneme kullanıcıları) before becoming patients.
-- Includes: CREATE TABLE + constraints.
-- Source of truth: Supabase table editor / migrations.
-- NOTE: RLS policies will be added in a later step.

CREATE TABLE public.trials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  full_name text NULL,
  phone text NULL,
  first_meet_at timestamp with time zone NULL,
  next_meet_at timestamp with time zone NULL,
  reference_id uuid NULL,
  created_at timestamp with time zone NULL DEFAULT now(),

  CONSTRAINT trials_pkey PRIMARY KEY (id),

  CONSTRAINT trials_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- RLS POLICIES PLACEHOLDER
-- TODO: Paste Supabase RLS definitions for `public.trials`.
--   ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY ...;
