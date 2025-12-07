-- db/schema/trials/trial_devices.sql
-- Purpose: Supabase table definition for `trial_devices`.
-- Stores quoted devices (brand/model/side/price) attached to a trial.
-- Includes: CREATE TABLE, constraints, and validation on side.
-- Source of truth: Supabase table editor / migrations.
-- NOTE: RLS policies will be added in a later step.

CREATE TABLE public.trial_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  trial_id uuid NOT NULL,
  side text NULL,
  brand text NULL,
  model text NULL,
  quote_price numeric(12, 2) NULL,

  CONSTRAINT trial_devices_pkey PRIMARY KEY (id),

  CONSTRAINT trial_devices_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT trial_devices_trial_id_fkey
    FOREIGN KEY (trial_id) REFERENCES public.trials (id) ON DELETE CASCADE,

  CONSTRAINT trial_devices_side_check CHECK (
    side IS NULL
    OR side = ANY (
      ARRAY['left'::text, 'right'::text, 'both'::text]
    )
  )
) TABLESPACE pg_default;

-- RLS POLICIES PLACEHOLDER
-- TODO: Paste Supabase RLS definitions for `public.trial_devices`.
--   ALTER TABLE public.trial_devices ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY ...;
