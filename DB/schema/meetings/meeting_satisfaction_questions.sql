-- meeting_satisfaction_questions.sql
-- Purpose: Individual questions attached to a given question list.
-- Used to build 5-question surveys per meeting.

CREATE TABLE public.meeting_satisfaction_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  list_id uuid NOT NULL REFERENCES public.meeting_satisfaction_question_lists(id) ON DELETE CASCADE,
  question_text text NOT NULL, -- e.g. "Cihaz ses kalitesinden memnun musunuz?"
  sort_order integer NOT NULL DEFAULT 0, -- order inside the list
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
