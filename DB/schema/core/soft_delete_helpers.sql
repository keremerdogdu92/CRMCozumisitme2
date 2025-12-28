-- DB/schema/core/soft_delete_helpers.sql
-- Purpose: Shared helpers for soft delete across CRM tables.
-- Summary:
-- - Provides a canonical trigger function that stamps deleted_by when a row is soft-deleted.
-- - Designed to be reused by multiple tables (patients, meetings, trial_devices, etc.).
-- Integrations:
-- - Uses auth.uid() and runs as SECURITY DEFINER.
-- - Tables must have columns: deleted_at timestamptz, deleted_by uuid (nullable).
--
-- v1.0.0 (2025-12-28):
-- - NEW: public.trg_soft_delete_set_deleted_by()

CREATE OR REPLACE FUNCTION public.trg_soft_delete_set_deleted_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If row is being soft-deleted (deleted_at transitions NULL -> NOT NULL),
  -- stamp deleted_by automatically.
  IF (OLD.deleted_at IS NULL) AND (NEW.deleted_at IS NOT NULL) THEN
    IF NEW.deleted_by IS NULL THEN
      NEW.deleted_by := auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
