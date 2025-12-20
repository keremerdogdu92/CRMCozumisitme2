-- meeting_satisfaction_question_lists.sql
-- Purpose: Stores survey question lists/templates for meeting satisfaction.
-- Each org can define multiple lists, e.g. "Genel Kontrol", "Teslimat Sonrası" etc.

CREATE TABLE public.meeting_satisfaction_question_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL, -- e.g. "Genel Kontrol", "Teslimat Sonrası"
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
