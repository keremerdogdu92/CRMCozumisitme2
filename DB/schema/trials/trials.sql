-- DB/schema/trials/trials.sql
-- Purpose: Supabase table definition for `public.trials`.
-- Integrations:
-- - Multi-org isolation via public.current_user_org_id() (never trust JWT org_id claims).
-- - Soft delete via deleted_at/deleted_by/delete_reason + RPCs:
--   - public.soft_delete_trials(p_id, p_reason)
--   - public.restore_trials(p_id)
--
-- v3.1.0 (2025-12-28):
-- - ALIGN WITH DB: add deleted_by + delete_reason (trials already had deleted_at).
-- - ALIGN WITH DB: add RPCs (soft delete + restore) and grant execute.
-- - ALIGN WITH DECISION: everyone can SELECT deleted rows; UI filters by deleted_at.
-- - ALIGN WITH DB: disable hard delete for authenticated (no DELETE policy, no DELETE grant).

CREATE TABLE IF NOT EXISTS public.trials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  full_name text NULL,
  phone text NULL,
  first_meet_at timestamp with time zone NULL,
  next_meet_at timestamp with time zone NULL,
  reference_id uuid NULL,
  note text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),

  -- Soft delete columns
  deleted_at timestamp with time zone NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT trials_pkey PRIMARY KEY (id),

  CONSTRAINT trials_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT trials_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES auth.users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- Soft delete filtering performance
CREATE INDEX IF NOT EXISTS trials_org_deleted_at_idx
  ON public.trials (org_id, deleted_at);

-- ============================================================
-- SOFT DELETE RPCs (UI must call RPC; hard delete is disabled)
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_trials(p_id uuid, p_reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.trials
  SET deleted_at = now(),
      deleted_by = auth.uid(),
      delete_reason = p_reason
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_trials(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_trials(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_trials(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.trials
  SET deleted_at = NULL,
      deleted_by = NULL,
      delete_reason = NULL
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_trials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_trials(uuid) TO authenticated;

-- ============================================================
-- RLS POLICIES FOR public.trials
-- ============================================================

ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies
DROP POLICY IF EXISTS "trials_service_full_access" ON public.trials;
DROP POLICY IF EXISTS "trials_org_select" ON public.trials;
DROP POLICY IF EXISTS "trials_org_insert" ON public.trials;
DROP POLICY IF EXISTS "trials_org_update" ON public.trials;
DROP POLICY IF EXISTS "trials_org_delete" ON public.trials;

-- Service role full access
CREATE POLICY "trials_service_full_access"
ON public.trials
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- SELECT: everyone in org can see both active + deleted; UI filters by deleted_at if needed.
CREATE POLICY "trials_org_select"
ON public.trials
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- INSERT: within org
CREATE POLICY "trials_org_insert"
ON public.trials
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- UPDATE: within org (needed for edits + soft delete/restore updates via RPC)
CREATE POLICY "trials_org_update"
ON public.trials
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- NOTE:
-- - Hard delete is intentionally disabled for authenticated users.
-- - No DELETE policy is created.

-- Grants (RLS still applies)
REVOKE ALL ON TABLE public.trials FROM anon;

-- Authenticated: no DELETE
GRANT SELECT, INSERT, UPDATE ON TABLE public.trials TO authenticated;

-- Service role: full control for administrative operations
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.trials TO service_role;
