-- DB/schema/trials/trials_convert_to_patient.rpc.sql
-- Purpose: Convert a trial into a patient-linked lead outcome WITHOUT deleting the trial.
-- Behavior:
--   - Verifies that trial and patient belong to the same org as the caller.
--   - Moves meetings from trial_id to patient_id.
--   - Updates trial:
--       status = 'converted'
--       converted_patient_id = p_patient_id
--       clears lost_at / lost_reason
--   - Does NOT delete the trial row and does NOT delete trial_devices.
-- Security:
--   - SECURITY DEFINER boundary with explicit org validation.
--   - Callable by authenticated users; hard delete is not used.

CREATE OR REPLACE FUNCTION public.link_trial_to_patient_and_delete(
  p_trial_id uuid,
  p_patient_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trial_org_id            uuid;
  v_patient_org_id          uuid;
  v_caller_org_id           uuid;
  v_trial_deleted_at        timestamptz;
  v_trial_status            text;
  v_trial_converted_patient uuid;
BEGIN
  -- Caller org (from canonical helper; do not trust JWT claims)
  v_caller_org_id := public.current_user_org_id();
  IF v_caller_org_id IS NULL THEN
    RAISE EXCEPTION 'CALLER_ORG_NOT_FOUND';
  END IF;

  -- Trial snapshot
  SELECT org_id, deleted_at, status, converted_patient_id
  INTO v_trial_org_id, v_trial_deleted_at, v_trial_status, v_trial_converted_patient
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

  -- Org safety check
  IF v_trial_org_id <> v_patient_org_id OR v_trial_org_id <> v_caller_org_id THEN
    RAISE EXCEPTION 'ORG_MISMATCH';
  END IF;

  -- Disallow converting a soft-deleted trial
  IF v_trial_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'TRIAL_DELETED';
  END IF;

  -- Idempotency / conflict protection
  IF v_trial_status = 'converted' THEN
    IF v_trial_converted_patient = p_patient_id THEN
      -- Already converted to this patient: no-op
      RETURN;
    END IF;
    RAISE EXCEPTION 'TRIAL_ALREADY_CONVERTED';
  END IF;

  IF v_trial_status = 'lost' THEN
    RAISE EXCEPTION 'TRIAL_ALREADY_LOST';
  END IF;

  -- 1) Meetings: trial -> patient
  UPDATE public.meetings
  SET
    patient_id   = p_patient_id,
    trial_id     = NULL,
    meeting_type = 'patient',
    subject_id   = p_patient_id
  WHERE trial_id = p_trial_id
    AND org_id = v_trial_org_id;

  -- 2) Trial: mark converted + link patient (no delete)
  UPDATE public.trials
  SET
    status = 'converted',
    converted_patient_id = p_patient_id,
    lost_at = NULL,
    lost_reason = NULL
  WHERE id = p_trial_id
    AND org_id = v_trial_org_id
    AND deleted_at IS NULL
    AND status = 'active';

END;
$$;

REVOKE ALL ON FUNCTION public.link_trial_to_patient_and_delete(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_trial_to_patient_and_delete(uuid, uuid) TO authenticated;
