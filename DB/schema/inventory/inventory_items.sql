-- DB/schema/inventory/inventory_items.sql
-- Purpose: Supabase table definition for `public.inventory_items`.
-- Multi-org standard:
-- - Org isolation via public.current_user_org_id().
-- - Soft delete via deleted_at (no hard delete policy by default).
--
-- v3.0.0:
-- - Replace profiles-subquery policies with helper-based policies.
-- - Add service_role bypass policy (optional but typical for imports/backoffice).

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

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies
DROP POLICY IF EXISTS "inventory_items_insert_by_org" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_select_by_org" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_update_by_org" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_service_full_access" ON public.inventory_items;

-- Service role full access (imports/backoffice)
CREATE POLICY "inventory_items_service_full_access"
ON public.inventory_items
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Org-scoped SELECT
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

-- Org-scoped UPDATE
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

REVOKE ALL ON TABLE public.inventory_items FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.inventory_items TO service_role;
