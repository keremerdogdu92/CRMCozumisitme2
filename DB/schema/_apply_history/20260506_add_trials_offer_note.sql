-- DB/schema/_apply_history/20260506_add_trials_offer_note.sql
-- Purpose: Add a patient-facing offer note to trial offers without printing internal notes.

ALTER TABLE public.trials
  ADD COLUMN IF NOT EXISTS offer_note text NULL;
