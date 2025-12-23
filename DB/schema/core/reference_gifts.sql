-- DB/schema/core/reference_gifts.sql
-- Purpose: Reference-level gifts/commission payments tracking (admin-managed).
-- v1.0.0:
-- - New table: public.reference_gifts
-- - Supports soft delete (deleted_at) and admin-only write access.
-- - SELECT is org-scoped; staff visibility can be tightened later if needed.

CREATE TABLE IF NOT EXISTS public.reference_gifts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  reference_id uuid NOT NULL,
  gift_type text NOT NULL DEFAULT 'other'::text,
  amount numeric(12, 2) NULL,
  gift_note text NULL,
  gift_at date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  CONSTRAINT reference_gifts_pkey PRIMARY KEY (id),
  CONSTRAINT reference_gifts_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES orgs (id) ON DELETE CASCADE,
  CONSTRAINT reference_gifts_reference_id_fkey FOREIGN KEY (reference_id)
    REFERENCES public.references (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS reference_gifts_org_id_idx
ON public.reference_gifts USING btree (org_id)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS reference_gifts_reference_id_idx
ON public.reference_gifts USING btree (reference_id)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS reference_gifts_deleted_at_idx
ON public.reference_gifts USING btree (deleted_at)
TABLESPACE pg_default;

ALTER TABLE public.reference_gifts ENABLE ROW LEVEL SECURITY;

-- Org-level SELECT for authenticated users (adjust later if you want staff hidden)
CREATE POLICY reference_gifts_org_select
ON public.reference_gifts
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = org_id
  )
);

-- Admin-only INSERT
CREATE POLICY reference_gifts_admin_insert
ON public.reference_gifts
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = org_id
      AND p.role = 'admin'::text
  )
);

-- Admin-only UPDATE
CREATE POLICY reference_gifts_admin_update
ON public.reference_gifts
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = org_id
      AND p.role = 'admin'::text
  )
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = org_id
      AND p.role = 'admin'::text
  )
);

-- Admin-only DELETE (temporary; replace with soft delete in app)
CREATE POLICY reference_gifts_admin_delete
ON public.reference_gifts
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = org_id
      AND p.role = 'admin'::text
  )
);
