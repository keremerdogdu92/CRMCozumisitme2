-- db/schema/trials/trials_convert_to_patient.rpc.sql
-- Purpose: Link a trial row to a newly created patient and cleanup trial data.
-- Behavior:
--   - Verifies that trial and patient belong to the same org.
--   - Moves meetings from trial_id to patient_id.
--   - Deletes the trial row (trial_devices will be deleted via ON DELETE CASCADE).
-- Security:
--   - Callable by authenticated users of the same org via RLS policies.
--   - Does NOT create the patient; it expects patient to be already created.

CREATE OR REPLACE FUNCTION public.link_trial_to_patient_and_delete(
  p_trial_id uuid,
  p_patient_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_org_id   uuid;
  v_patient_org_id uuid;
  v_caller_org_id  uuid;
BEGIN
  -- Caller org (from profiles)
  SELECT p.org_id
  INTO v_caller_org_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  IF v_caller_org_id IS NULL THEN
    RAISE EXCEPTION 'CALLER_ORG_NOT_FOUND';
  END IF;

  -- Trial org
  SELECT org_id
  INTO v_trial_org_id
  FROM public.trials
  WHERE id = p_trial_id;

  IF v_trial_org_id IS NULL THEN
    RAISE EXCEPTION 'TRIAL_NOT_FOUND';
  END IF;

  -- Patient org
  SELECT org_id
  INTO v_patient_org_id
  FROM public.patients
  WHERE id = p_patient_id;

  IF v_patient_org_id IS NULL THEN
    RAISE EXCEPTION 'PATIENT_NOT_FOUND';
  END IF;

  -- Org güvenlik kontrolü
  IF v_trial_org_id <> v_patient_org_id OR v_trial_org_id <> v_caller_org_id THEN
    RAISE EXCEPTION 'ORG_MISMATCH';
  END IF;

  -- 1) Meetings: trial → patient
  UPDATE public.meetings
  SET
    patient_id   = p_patient_id,
    trial_id     = NULL,
    meeting_type = 'patient',
    subject_id   = p_patient_id
  WHERE trial_id = p_trial_id
    AND org_id = v_trial_org_id;

  -- 2) Trial row: delete (trial_devices will be deleted by FK ON DELETE CASCADE)
  DELETE FROM public.trials
  WHERE id = p_trial_id
    AND org_id = v_trial_org_id;

END;
$$;
