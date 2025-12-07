-- db/schema/meetings/meeting_accessories.sql
-- Purpose: Supabase table definition for `meeting_accessories`.
-- Stores accessory sales linked to meetings (filters, wax guards, batteries, etc.)
-- Includes: CREATE TABLE, constraints, and indexes.
-- Source of truth: Supabase table editor / migrations.
-- NOTE: RLS policies will be added in a separate step.

CREATE TABLE public.meeting_accessories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  meeting_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  name text NOT NULL,
  cost_price numeric(12, 2) NOT NULL DEFAULT 0,
  sale_price numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT meeting_accessories_pkey PRIMARY KEY (id),

  CONSTRAINT meeting_accessories_meeting_id_fkey
    FOREIGN KEY (meeting_id) REFERENCES public.meetings (id) ON DELETE CASCADE,

  CONSTRAINT meeting_accessories_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients (id) ON DELETE RESTRICT,

  CONSTRAINT meeting_accessories_cost_price_check CHECK (cost_price >= 0),
  CONSTRAINT meeting_accessories_sale_price_check CHECK (sale_price >= 0)
) TABLESPACE pg_default;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meeting_accessories_meeting_id
  ON public.meeting_accessories USING btree (meeting_id)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meeting_accessories_patient_id
  ON public.meeting_accessories USING btree (patient_id)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meeting_accessories_org_id
  ON public.meeting_accessories USING btree (org_id)
  TABLESPACE pg_default;

-- RLS POLICIES PLACEHOLDER
-- TODO: Paste Supabase RLS definitions for `public.meeting_accessories`.
--   ALTER TABLE public.meeting_accessories ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY ...;
