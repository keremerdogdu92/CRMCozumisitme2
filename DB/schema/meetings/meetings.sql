-- db/schema/meetings/meetings.sql
-- Purpose: Supabase table definition for `meetings`.
-- Stores patient/trial/reference meetings with notes, satisfaction score and scheduling info.
-- Includes: CREATE TABLE, constraints, triggers and current RLS policies.
-- Source of truth: Supabase table editor / migrations.

-- TABLE DEFINITION -----------------------------------------------------------

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
    FOREIGN KEY (created_by)
    REFERENCES public.profiles (id)
    ON DELETE SET NULL,

  CONSTRAINT meetings_org_id_fkey
    FOREIGN KEY (org_id)
    REFERENCES public.orgs (id)
    ON DELETE CASCADE,

  CONSTRAINT meetings_patient_id_fkey
    FOREIGN KEY (patient_id)
    REFERENCES public.patients (id)
    ON DELETE SET NULL,

  CONSTRAINT meetings_trial_id_fkey
    FOREIGN KEY (trial_id)
    REFERENCES public.trials (id)
    ON DELETE SET NULL,

  CONSTRAINT meetings_satisfaction_10_check CHECK (
    satisfaction_10 >= 1 AND satisfaction_10 <= 10
  )
) TABLESPACE pg_default;

-- TRIGGERS -------------------------------------------------------------------

CREATE TRIGGER meeting_after_write_trigger
AFTER INSERT OR UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION meeting_after_write();

-- ROW LEVEL SECURITY (RLS) ---------------------------------------------------
-- These policies are copied from the Supabase UI (Policies tab for `public.meetings`).

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Policy: meetings_select_by_org_and_type
-- Behavior: PERMISSIVE
-- Command:  SELECT
-- Roles:    authenticated
CREATE POLICY "meetings_select_by_org_and_type"
ON "public"."meetings"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE
      p.id = auth.uid()
      AND p.org_id = meetings.org_id
      AND (
        p.role = 'admin'::text
        OR meetings.meeting_type <> 'reference'::text
      )
  )
);

-- Policy: meetings_insert_by_org_and_type
-- Behavior: PERMISSIVE
-- Command:  INSERT
-- Roles:    authenticated
CREATE POLICY "meetings_insert_by_org_and_type"
ON "public"."meetings"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE
      p.id = auth.uid()
      AND p.org_id = meetings.org_id
      AND (
        p.role = 'admin'::text
        OR meetings.meeting_type <> 'reference'::text
      )
  )
);

-- DELETE STRATEGY / TODO -----------------------------------------------------
-- 1) Decide on delete model for meetings:
--    - Option A: add `deleted_at timestamptz` (soft delete),
--    - Option B: add `is_deleted boolean DEFAULT false`.
-- 2) Application default queries should exclude deleted meetings:
--    - e.g. WHERE deleted_at IS NULL (or is_deleted = false).
-- 3) Only admin users (profiles.role = 'admin') should be able to:
--    - hard DELETE meetings, or
--    - toggle the soft-delete flag.
-- 4) When a reference row is deleted/deactivated, decide how related
--    meetings should behave:
--    - keep history but hide in daily views,
--    - or show a warning in the UI when opening such meetings.
-- 5) After the soft-delete model is decided and implemented, add
--    corresponding RLS rules for DELETE (and/or UPDATE of deleted_at).
