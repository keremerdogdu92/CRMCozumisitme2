-- db/schema/core/references.sql
-- Purpose: Supabase table definition for `references`.
-- Includes: CREATE TABLE, constraints, and indexes for reference contacts.
-- Source of truth: Supabase table editor / migrations.
-- NOTE: RLS policies for `references` will be added in a separate pass.

CREATE TABLE public.references (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  full_name text NULL,
  "group" text NULL,
  last_meet_at date NULL,
  next_meet_at date NULL,
  note text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  phone text NULL,
  notes text NULL,
  commission_scheme text NULL,
  commission_percent numeric NULL,
  commission_fixed numeric NULL,
  is_active boolean NOT NULL DEFAULT true,
  contact_interval_days integer NULL,
  CONSTRAINT references_pkey PRIMARY KEY (id),
  CONSTRAINT references_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES orgs (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS references_org_id_idx
ON public."references" USING btree (org_id)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS references_created_at_idx
ON public."references" USING btree (created_at DESC)
TABLESPACE pg_default;

-- RLS POLICIES PLACEHOLDER
-- TODO: Copy/paste all RLS policies for `public.references` from Supabase.
--   ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY ...;
