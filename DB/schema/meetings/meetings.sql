-- db/schema/meetings/meetings.sql
-- Purpose: Supabase table definition for `meetings`.
-- Stores patient/trial/reference meetings with notes, satisfaction score and scheduling info.
-- Includes: CREATE TABLE, constraints, and triggers.
-- Source of truth: Supabase table editor / migrations.
-- NOTE: RLS policies will be added in a separate pass.

CREATE TABLE public.meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  subject text NULL,
  note text NULL,
  at timestamp with time zone NULL,
  next_at timestamp with time zone NULL,
  satisfaction_10 integer NULL,
  patient_id uuid NULL,
  trial_id uuid NULL,
  reference_id uuid NULL,
  created_by uuid NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  meeting_type text NOT NULL DEFAULT 'patient'::text,
  subject_id uuid NULL,
  subject_name text NULL,
  CONSTRAINT meetings_pkey PRIMARY KEY (id),
  CONSTRAINT meetings_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles (id) ON DELETE SET NULL,
  CONSTRAINT meetings_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES orgs (id) ON DELETE CASCADE,
  CONSTRAINT meetings_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE SET NULL,
  CONSTRAINT meetings_trial_id_fkey
    FOREIGN KEY (trial_id) REFERENCES trials (id) ON DELETE SET NULL,
  CONSTRAINT meetings_satisfaction_10_check CHECK (
    satisfaction_10 >= 1 AND satisfaction_10 <= 10
  )
) TABLESPACE pg_default;

CREATE TRIGGER meeting_after_write_trigger
AFTER INSERT OR UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION meeting_after_write();

-- RLS POLICIES PLACEHOLDER
-- TODO: Paste RLS definitions for `public.meetings` from Supabase.
--   ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY ...;
