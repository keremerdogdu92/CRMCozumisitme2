-- DB/schema/core/org_settings.sql
-- Purpose: Per-organization settings used for quote / offer printouts and
--          other organization-level configuration (branding, contact info).
-- Notes:
--   - One row per org_id (PRIMARY KEY = org_id).
--   - Multi-tenant isolation via org_id resolved from profiles.org_id (auth.uid()).
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

-- Link to orgs.id (matches DB: REFERENCES orgs(id) ON DELETE CASCADE)
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

-- Make sure RLS is enabled (matches DB)
ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

-- Drop old/legacy policies (from earlier repo versions) so repo matches DB
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'org_settings'
      AND policyname = 'org_settings_select_own_org'
  ) THEN
    DROP POLICY org_settings_select_own_org ON public.org_settings;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'org_settings'
      AND policyname = 'org_settings_upsert_own_org'
  ) THEN
    DROP POLICY org_settings_upsert_own_org ON public.org_settings;
  END IF;
END$$;

-- Policies (match DB exactly: resolve org_id via profiles.org_id for auth.uid())

-- SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'org_settings'
      AND policyname = 'org_settings_select_by_profile'
  ) THEN
    CREATE POLICY org_settings_select_by_profile
      ON public.org_settings
      FOR SELECT
      TO public
      USING (
        org_id = (
          SELECT profiles.org_id
          FROM profiles
          WHERE profiles.id = auth.uid()
        )
      );
  END IF;
END$$;

-- INSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'org_settings'
      AND policyname = 'org_settings_insert_by_profile'
  ) THEN
    CREATE POLICY org_settings_insert_by_profile
      ON public.org_settings
      FOR INSERT
      TO public
      WITH CHECK (
        org_id = (
          SELECT profiles.org_id
          FROM profiles
          WHERE profiles.id = auth.uid()
        )
      );
  END IF;
END$$;

-- UPDATE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'org_settings'
      AND policyname = 'org_settings_update_by_profile'
  ) THEN
    CREATE POLICY org_settings_update_by_profile
      ON public.org_settings
      FOR UPDATE
      TO public
      USING (
        org_id = (
          SELECT profiles.org_id
          FROM profiles
          WHERE profiles.id = auth.uid()
        )
      )
      WITH CHECK (
        org_id = (
          SELECT profiles.org_id
          FROM profiles
          WHERE profiles.id = auth.uid()
        )
      );
  END IF;
END$$;

-- Grants (match DB output)
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.org_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.org_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.org_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.org_settings TO postgres;
