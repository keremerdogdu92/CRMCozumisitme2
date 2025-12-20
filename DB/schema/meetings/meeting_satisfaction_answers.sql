-- meeting_satisfaction_answers.sql
-- Purpose: Stores per-question 1-5 satisfaction scores for a given meeting.

CREATE TABLE public.meeting_satisfaction_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.meeting_satisfaction_question_lists(id) ON DELETE RESTRICT,
  question_id uuid NOT NULL REFERENCES public.meeting_satisfaction_questions(id) ON DELETE RESTRICT,
  score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Optional helper index for reporting
CREATE INDEX meeting_satisfaction_answers_meeting_idx
  ON public.meeting_satisfaction_answers (org_id, meeting_id);

CREATE INDEX meeting_satisfaction_answers_patient_idx
  ON public.meeting_satisfaction_answers (org_id, patient_id);

CREATE INDEX meeting_satisfaction_answers_list_idx
  ON public.meeting_satisfaction_answers (org_id, list_id);
