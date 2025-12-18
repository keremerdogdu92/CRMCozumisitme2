-- DB/schema/core/org_settings.sql
-- Purpose: Per-organization settings used for quote / offer printouts and
--          other organization-level configuration (branding, contact info).
-- Notes:
--   - One row per org_id (PRIMARY KEY = org_id).
--   - Multi-tenant isolation via org_id + JWT claim (auth.jwt()->>'org_id').
--   - Exposed via PostgREST as /rest/v1/org_settings.

CREATE TABLE IF NOT EXISTS public.org_settings (
  org_id uuid NOT NULL,
  company_name text NULL,
  company_tagline text NULL,
  phone text NULL,
  address text NULL,
  website text NULL,
  logo_url text NULL,
  offer_watermark text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_settings_pkey PRIMARY KEY (org_id)
);

-- Optional but recommended: link to orgs.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'org_settings_org_id_fkey'
  ) THEN
    ALTER TABLE public.org_settings
      ADD CONSTRAINT org_settings_org_id_fkey
      FOREIGN KEY (org_id)
      REFERENCES public.orgs (id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- Make sure RLS is enabled
ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

-- Policy: users only see their own org row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'org_settings'
      AND policyname = 'org_settings_select_own_org'
  ) THEN
    CREATE POLICY org_settings_select_own_org
      ON public.org_settings
      FOR SELECT
      USING (org_id = (auth.jwt()->>'org_id')::uuid);
  END IF;
END$$;

-- Policy: users may insert/update their own org row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'org_settings'
      AND policyname = 'org_settings_upsert_own_org'
  ) THEN
    CREATE POLICY org_settings_upsert_own_org
      ON public.org_settings
      FOR INSERT, UPDATE
      USING (org_id = (auth.jwt()->>'org_id')::uuid)
      WITH CHECK (org_id = (auth.jwt()->>'org_id')::uuid);
  END IF;
END$$;
