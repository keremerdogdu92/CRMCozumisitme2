-- DB/schema/inventory/update_inventory_item_details.rpc.sql
-- Purpose: Org-scoped general inventory item edit, without changing sale/patient binding.

CREATE OR REPLACE FUNCTION public.update_inventory_item_details(
  p_id uuid,
  p_brand text,
  p_model text,
  p_item_type text,
  p_catalog_model_id uuid DEFAULT NULL::uuid,
  p_barcode text DEFAULT NULL::text,
  p_serial_no text DEFAULT NULL::text,
  p_ear_side text DEFAULT NULL::text,
  p_purchase_price numeric DEFAULT NULL::numeric,
  p_list_price numeric DEFAULT NULL::numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id uuid := public.current_user_org_id();
  v_item public.inventory_items%ROWTYPE;
  v_serial text := nullif(btrim(coalesce(p_serial_no, '')), '');
  v_catalog_org uuid;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_NO_ORG' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_item
  FROM public.inventory_items
  WHERE id = p_id
    AND org_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVENTORY_ITEM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_item.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'INVENTORY_ITEM_DELETED' USING ERRCODE = '23514';
  END IF;

  IF nullif(btrim(coalesce(p_brand, '')), '') IS NULL THEN
    RAISE EXCEPTION 'BRAND_REQUIRED' USING ERRCODE = '23514';
  END IF;

  IF nullif(btrim(coalesce(p_model, '')), '') IS NULL THEN
    RAISE EXCEPTION 'MODEL_REQUIRED' USING ERRCODE = '23514';
  END IF;

  IF p_item_type NOT IN ('hearing_aid', 'charger') THEN
    RAISE EXCEPTION 'INVALID_ITEM_TYPE' USING ERRCODE = '23514';
  END IF;

  IF p_ear_side IS NOT NULL AND p_ear_side NOT IN ('right', 'left', 'bilateral') THEN
    RAISE EXCEPTION 'INVALID_EAR_SIDE' USING ERRCODE = '23514';
  END IF;

  IF p_purchase_price IS NOT NULL AND p_purchase_price < 0 THEN
    RAISE EXCEPTION 'INVALID_PURCHASE_PRICE' USING ERRCODE = '23514';
  END IF;

  IF p_list_price IS NOT NULL AND p_list_price < 0 THEN
    RAISE EXCEPTION 'INVALID_LIST_PRICE' USING ERRCODE = '23514';
  END IF;

  IF v_serial IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.inventory_items i
    WHERE i.org_id = v_org_id
      AND i.deleted_at IS NULL
      AND i.id <> p_id
      AND lower(i.serial_no) = lower(v_serial)
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_ACTIVE_SERIAL_NO' USING ERRCODE = '23505';
  END IF;

  IF p_catalog_model_id IS NOT NULL THEN
    SELECT org_id
    INTO v_catalog_org
    FROM public.device_catalog_models
    WHERE id = p_catalog_model_id;

    IF v_catalog_org IS DISTINCT FROM v_org_id THEN
      RAISE EXCEPTION 'CATALOG_MODEL_NOT_FOUND_IN_ORG' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.inventory_items
  SET brand = btrim(p_brand),
      model = btrim(p_model),
      item_type = p_item_type,
      catalog_model_id = p_catalog_model_id,
      barcode = nullif(btrim(coalesce(p_barcode, '')), ''),
      serial_no = v_serial,
      ear_side = p_ear_side,
      purchase_price = p_purchase_price,
      list_price = p_list_price,
      updated_at = now()
  WHERE id = p_id
    AND org_id = v_org_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_inventory_item_details(
  uuid, text, text, text, uuid, text, text, text, numeric, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_inventory_item_details(
  uuid, text, text, text, uuid, text, text, text, numeric, numeric
) TO authenticated, service_role;
