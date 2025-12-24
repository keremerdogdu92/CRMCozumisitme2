-- DB/schema/_migrations_apply_latest.sql
-- Purpose: Apply latest multi-org standard to references, reference_gifts, patients.
-- Applies:
-- - Fix references RLS broken org check (p.org_id = p.org_id) -> helper-based.
-- - Standardize reference_gifts RLS -> helper-based.
-- - Replace patients permissive policy (USING true) -> org-scoped policies.
--
-- Safe to run multiple times (DROP POLICY IF EXISTS used).

BEGIN;

-- ============================================================
-- references: RLS policies
-- ============================================================

ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS references_org_select ON public.references;
DROP POLICY IF EXISTS references_staff_select_active ON public.references;
DROP POLICY IF EXISTS references_admin_select_all ON public.references;
DROP POLICY IF EXISTS references_admin_insert ON public.references;
DROP POLICY IF EXISTS references_admin_update ON public.references;
DROP POLICY IF EXISTS references_admin_delete ON public.references;

CREATE POLICY references_staff_select_active
ON public.references
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND deleted_at IS NULL
    AND is_active = true
    AND public.current_user_role() <> 'admin'
  )
);

CREATE POLICY references_admin_select_all
ON public.references
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

CREATE POLICY references_admin_insert
ON public.references
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

CREATE POLICY references_admin_update
ON public.references
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

CREATE POLICY references_admin_delete
ON public.references
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

-- ============================================================
-- reference_gifts: RLS policies
-- ============================================================

ALTER TABLE public.reference_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reference_gifts_org_select ON public.reference_gifts;
DROP POLICY IF EXISTS reference_gifts_admin_insert ON public.reference_gifts;
DROP POLICY IF EXISTS reference_gifts_admin_update ON public.reference_gifts;
DROP POLICY IF EXISTS reference_gifts_admin_delete ON public.reference_gifts;

CREATE POLICY reference_gifts_org_select
ON public.reference_gifts
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

CREATE POLICY reference_gifts_admin_insert
ON public.reference_gifts
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

CREATE POLICY reference_gifts_admin_update
ON public.reference_gifts
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

CREATE POLICY reference_gifts_admin_delete
ON public.reference_gifts
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

-- ============================================================
-- patients: remove permissive policy, add org-scoped policies
-- ============================================================

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patients_all_authenticated" ON public.patients;

DROP POLICY IF EXISTS patients_select_by_org ON public.patients;
DROP POLICY IF EXISTS patients_insert_by_org ON public.patients;
DROP POLICY IF EXISTS patients_update_by_org ON public.patients;
DROP POLICY IF EXISTS patients_delete_by_org ON public.patients;

CREATE POLICY patients_select_by_org
ON public.patients
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

CREATE POLICY patients_insert_by_org
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

CREATE POLICY patients_update_by_org
ON public.patients
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

CREATE POLICY patients_delete_by_org
ON public.patients
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

COMMIT;
