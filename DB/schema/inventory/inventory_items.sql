-- DB/schema/inventory/inventory_items.sql
-- Purpose: Supabase table definition for `public.inventory_items`.
-- Integrations:
-- - Multi-org isolation via public.current_user_org_id().
-- - Soft delete via deleted_at + RPCs:
--   - public.soft_delete_inventory_items(p_id)
--   - public.restore_inventory_items(p_id)
-- - Hard delete is disabled for authenticated users (no DELETE policy, no DELETE grant).
--
-- v3.1.0 (2025-12-28):
-- - ALIGN WITH DB: add (org_id, deleted_at) index (inventory_items_org_deleted_at_idx).
-- - ALIGN WITH DECISION: hard delete disabled (no DELETE policy, no DELETE grant).
-- - ALIGN WITH DB: include soft delete + restore RPCs for UI usage.
-- - KEEP: helper-based org policies and existing indexes.

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  item_type text NOT NULL,
  barcode text NULL,
  serial_no text NULL,
  ear_side text NULL,
  status text NOT NULL DEFAULT 'in_stock'::text,
  purchase_price numeric(12, 2) NULL,
  list_price numeric(12, 2) NULL,
  sold_patient_id uuid NULL,
  sold_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  -- Soft delete column (DB currently uses deleted_at only for this table)
  deleted_at timestamp with time zone NULL,

  device_price numeric(12, 2) NULL,

  CONSTRAINT inventory_items_pkey PRIMARY KEY (id),

  CONSTRAINT inventory_items_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT inventory_items_ear_side_check CHECK (
    ear_side IS NULL
    OR ear_side = ANY (ARRAY['right'::text, 'left'::text, 'bilateral'::text])
  ),

  CONSTRAINT inventory_items_item_type_check CHECK (
    item_type = ANY (ARRAY['hearing_aid'::text, 'charger'::text])
  ),

  CONSTRAINT inventory_items_status_check CHECK (
    status = ANY (ARRAY['in_stock'::text, 'sold'::text, 'repair'::text])
  )
) TABLESPACE pg_default;

-- Existing indexes
CREATE INDEX IF NOT EXISTS inventory_items_org_status_idx
ON public.inventory_items USING btree (org_id, status)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS inventory_items_org_brand_model_idx
ON public.inventory_items USING btree (org_id, brand, model)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS inventory_items_org_model_idx
ON public.inventory_items USING btree (org_id, model)
TABLESPACE pg_default
WHERE deleted_at IS NULL;

-- Soft delete filtering performance (added by batch in DB)
CREATE INDEX IF NOT EXISTS inventory_items_org_deleted_at_idx
ON public.inventory_items (org_id, deleted_at);

-- ============================================================
-- SOFT DELETE RPCs (UI must call RPC; hard delete is disabled)
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_inventory_items(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.inventory_items
  SET deleted_at = now()
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_inventory_items(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_inventory_items(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_inventory_items(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.inventory_items
  SET deleted_at = NULL
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_inventory_items(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_inventory_items(uuid) TO authenticated;

-- ============================================================
-- RLS POLICIES FOR public.inventory_items
-- ============================================================

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies
DROP POLICY IF EXISTS "inventory_items_insert_by_org" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_select_by_org" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_update_by_org" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_service_full_access" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_delete_by_org" ON public.inventory_items;

-- Service role full access (imports/backoffice)
CREATE POLICY "inventory_items_service_full_access"
ON public.inventory_items
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Org-scoped SELECT (includes deleted rows; UI filters by deleted_at if needed)
CREATE POLICY "inventory_items_select_by_org"
ON public.inventory_items
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- Org-scoped INSERT
CREATE POLICY "inventory_items_insert_by_org"
ON public.inventory_items
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- Org-scoped UPDATE (needed for edits + soft delete/restore via RPC)
CREATE POLICY "inventory_items_update_by_org"
ON public.inventory_items
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
REVOKE ALL ON TABLE public.inventory_items FROM anon;

-- Authenticated: no DELETE
GRANT SELECT, INSERT, UPDATE ON TABLE public.inventory_items TO authenticated;

-- Service role: full control for administrative operations
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.inventory_items TO service_role;
