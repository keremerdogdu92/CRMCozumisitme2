-- db/schema/core/org_settings.sql
-- Purpose: Per-organization settings used for quote / offer printouts and other org config.
-- Notes:
-- - One row per org_id (PRIMARY KEY = org_id).
-- - Multi-tenant isolation via org_id resolved from profiles (auth.uid()) using helper.
--
-- v2.0.0:
-- - RLS uses public.current_user_org_id() (no JWT trust, no subquery duplication)

CREATE TABLE IF NOT EXISTS public.org_settings (
  org_id uuid NOT NULL,
  company_name text NULL,
  company_tagline text NULL,
  phone text NULL,
  address text NULL,
  website text NULL,
  logo_url text NULL,
  offer_watermark text NULL,
  theme_preset text NOT NULL DEFAULT 'cozum',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_settings_pkey PRIMARY KEY (org_id),
  CONSTRAINT org_settings_theme_preset_check CHECK (
    theme_preset = ANY (ARRAY['cozum'::text, 'navy'::text, 'graphite'::text])
  )
);

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS theme_preset text NOT NULL DEFAULT 'cozum';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'org_settings_theme_preset_check'
  ) THEN
    ALTER TABLE public.org_settings
      ADD CONSTRAINT org_settings_theme_preset_check CHECK (
        theme_preset = ANY (ARRAY['cozum'::text, 'navy'::text, 'graphite'::text])
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'org_settings_org_id_fkey'
  ) THEN
    ALTER TABLE public.org_settings
      ADD CONSTRAINT org_settings_org_id_fkey
      FOREIGN KEY (org_id)
      REFERENCES public.orgs (id)
      ON DELETE CASCADE;
  END IF;
END$$;

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

-- Drop any older policies to keep repo deterministic
DROP POLICY IF EXISTS org_settings_select_by_profile ON public.org_settings;
DROP POLICY IF EXISTS org_settings_insert_by_profile ON public.org_settings;
DROP POLICY IF EXISTS org_settings_update_by_profile ON public.org_settings;

CREATE POLICY org_settings_select_by_profile
  ON public.org_settings
  FOR SELECT
  TO authenticated
  USING (org_id = public.current_user_org_id());

CREATE POLICY org_settings_insert_by_profile
  ON public.org_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY org_settings_update_by_profile
  ON public.org_settings
  FOR UPDATE
  TO authenticated
  USING (org_id = public.current_user_org_id())
  WITH CHECK (org_id = public.current_user_org_id());

REVOKE ALL ON TABLE public.org_settings FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.org_settings TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.org_settings TO authenticated;
