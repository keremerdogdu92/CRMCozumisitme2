-- DB/schema/meetings/meetings.sql
-- Purpose: Supabase table definition for `public.meetings`.
-- Multi-org standard:
-- - Org isolation via public.current_user_org_id().
-- - Reference-type meetings visible/writable only to admin (within org).
--
-- v3.0.0:
-- - Replace profiles-subquery org isolation with helper-based.
-- - Add UPDATE policy (mirrors INSERT rule) to avoid edit failures.

CREATE TABLE IF NOT EXISTS public.meetings (
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

DROP TRIGGER IF EXISTS meeting_after_write_trigger ON public.meetings;

CREATE TRIGGER meeting_after_write_trigger
AFTER INSERT OR UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION meeting_after_write();

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies
DROP POLICY IF EXISTS "meetings_select_by_org_and_type" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert_by_org_and_type" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update_by_org_and_type" ON public.meetings;

-- SELECT
CREATE POLICY "meetings_select_by_org_and_type"
ON public.meetings
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
);

-- INSERT
CREATE POLICY "meetings_insert_by_org_and_type"
ON public.meetings
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
);

-- UPDATE (needed for editing meetings)
CREATE POLICY "meetings_update_by_org_and_type"
ON public.meetings
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
);

REVOKE ALL ON TABLE public.meetings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meetings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.meetings TO service_role;
