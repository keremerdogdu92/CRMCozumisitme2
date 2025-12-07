-- db/schema/meetings/meeting_payments.sql
-- Purpose: Supabase table definition for `meeting_payments`.
-- Stores payments recorded during meetings for patients (Senet, Kredi Kartı, Nakit, etc.)
-- Includes: CREATE TABLE, constraints, and indexes.
-- Source of truth: Supabase table editor / migrations.
-- NOTE: RLS policies will be added in a separate pass.

CREATE TABLE public.meeting_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  meeting_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  amount numeric(12, 2) NOT NULL,
  method text NOT NULL DEFAULT 'Senet'::text,
  note text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT meeting_payments_pkey PRIMARY KEY (id),

  CONSTRAINT meeting_payments_meeting_id_fkey
    FOREIGN KEY (meeting_id) REFERENCES public.meetings (id) ON DELETE CASCADE,

  CONSTRAINT meeting_payments_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients (id) ON DELETE RESTRICT,

  CONSTRAINT meeting_payments_amount_check CHECK (amount > 0),

  CONSTRAINT meeting_payments_method_check CHECK (
    method = ANY (
      ARRAY[
        'Tim'::text,
        'Sivantos'::text,
        'Kredi_Kartı'::text,
        'Nakit'::text,
        'Senet'::text
      ]
    )
  )
) TABLESPACE pg_default;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meeting_payments_meeting_id
  ON public.meeting_payments USING btree (meeting_id)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meeting_payments_patient_id
  ON public.meeting_payments USING btree (patient_id)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meeting_payments_org_id
  ON public.meeting_payments USING btree (org_id)
  TABLESPACE pg_default;

-- RLS POLICIES PLACEHOLDER
-- TODO: Paste Supabase RLS definitions for `public.meeting_payments`.
--   ALTER TABLE public.meeting_payments ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY ...;
