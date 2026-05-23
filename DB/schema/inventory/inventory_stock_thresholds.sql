-- DB/schema/inventory/inventory_stock_thresholds.sql
-- Per-org stock warning thresholds.
-- General rows use item_type + catalog_model_id NULL.
-- Model override rows use catalog_model_id and override the general item_type threshold.

CREATE TABLE IF NOT EXISTS public.inventory_stock_thresholds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  item_type text NULL,
  catalog_model_id uuid NULL,
  minimum_stock integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT inventory_stock_thresholds_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_stock_thresholds_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,
  CONSTRAINT inventory_stock_thresholds_catalog_model_id_fkey
    FOREIGN KEY (catalog_model_id) REFERENCES public.device_catalog_models (id) ON DELETE CASCADE,
  CONSTRAINT inventory_stock_thresholds_minimum_stock_check
    CHECK (minimum_stock >= 0),
  CONSTRAINT inventory_stock_thresholds_item_type_check
    CHECK (
      item_type IS NULL
      OR item_type = ANY (ARRAY[
        'hearing_aid'::text,
        'charger'::text,
        'receiver'::text,
        'battery'::text
      ])
    ),
  CONSTRAINT inventory_stock_thresholds_scope_check
    CHECK (
      (catalog_model_id IS NULL AND item_type IS NOT NULL)
      OR catalog_model_id IS NOT NULL
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_stock_thresholds_general_uidx
ON public.inventory_stock_thresholds (org_id, item_type)
WHERE catalog_model_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_stock_thresholds_model_uidx
ON public.inventory_stock_thresholds (org_id, catalog_model_id)
WHERE catalog_model_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_stock_thresholds_org_idx
ON public.inventory_stock_thresholds (org_id);

CREATE INDEX IF NOT EXISTS inventory_stock_thresholds_catalog_model_fk_idx
ON public.inventory_stock_thresholds (catalog_model_id);

ALTER TABLE public.inventory_stock_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_stock_thresholds_service_full_access ON public.inventory_stock_thresholds;
DROP POLICY IF EXISTS inventory_stock_thresholds_select_by_org ON public.inventory_stock_thresholds;
DROP POLICY IF EXISTS inventory_stock_thresholds_write_admin_by_org ON public.inventory_stock_thresholds;

CREATE POLICY inventory_stock_thresholds_service_full_access
ON public.inventory_stock_thresholds
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY inventory_stock_thresholds_select_by_org
ON public.inventory_stock_thresholds
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY inventory_stock_thresholds_write_admin_by_org
ON public.inventory_stock_thresholds
AS PERMISSIVE
FOR ALL
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

REVOKE ALL ON TABLE public.inventory_stock_thresholds FROM anon;
REVOKE ALL ON TABLE public.inventory_stock_thresholds FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_stock_thresholds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.inventory_stock_thresholds TO service_role;
