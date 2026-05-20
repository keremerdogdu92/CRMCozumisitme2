-- DB/schema/patients/patient_inventory_item_rpcs.sql
-- Purpose: Atomic patient inventory attach/replace helpers.
-- Notes:
-- - Used by Patient Detail -> Cihazlar tab.
-- - Keeps inventory_items as the source of truth for patient devices.
-- - Enforces org scope through public.current_user_org_id().

CREATE OR REPLACE FUNCTION public.attach_patient_inventory_item(
  p_patient_id uuid,
  p_inventory_item_id uuid,
  p_ear_side text,
  p_sold_at timestamptz DEFAULT now(),
  p_device_price numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid;
  v_patient_org_id uuid;
BEGIN
  v_org_id := public.current_user_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'ATTACH_PATIENT_INVENTORY_ITEM_NO_ORG';
  END IF;

  IF p_ear_side IS NULL OR p_ear_side NOT IN ('right', 'left', 'bilateral') THEN
    RAISE EXCEPTION 'ATTACH_PATIENT_INVENTORY_ITEM_INVALID_EAR_SIDE';
  END IF;

  SELECT p.org_id
    INTO v_patient_org_id
  FROM public.patients p
  WHERE p.id = p_patient_id
    AND p.deleted_at IS NULL;

  IF v_patient_org_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'ATTACH_PATIENT_INVENTORY_ITEM_PATIENT_NOT_FOUND';
  END IF;

  UPDATE public.inventory_items i
  SET sold_patient_id = p_patient_id,
      sold_at = COALESCE(p_sold_at, now()),
      ear_side = p_ear_side,
      device_price = p_device_price,
      status = 'sold',
      updated_at = now()
  WHERE i.id = p_inventory_item_id
    AND i.org_id = v_org_id
    AND i.deleted_at IS NULL
    AND i.status = 'in_stock'
    AND i.sold_patient_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATTACH_PATIENT_INVENTORY_ITEM_NOT_AVAILABLE';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.attach_patient_inventory_item(uuid, uuid, text, timestamptz, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_patient_inventory_item(uuid, uuid, text, timestamptz, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.replace_patient_inventory_item(
  p_patient_id uuid,
  p_old_inventory_item_id uuid,
  p_new_inventory_item_id uuid,
  p_ear_side text,
  p_sold_at timestamptz DEFAULT now(),
  p_device_price numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid;
  v_patient_org_id uuid;
BEGIN
  v_org_id := public.current_user_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'REPLACE_PATIENT_INVENTORY_ITEM_NO_ORG';
  END IF;

  IF p_old_inventory_item_id = p_new_inventory_item_id THEN
    RAISE EXCEPTION 'REPLACE_PATIENT_INVENTORY_ITEM_SAME_ITEM';
  END IF;

  IF p_ear_side IS NULL OR p_ear_side NOT IN ('right', 'left', 'bilateral') THEN
    RAISE EXCEPTION 'REPLACE_PATIENT_INVENTORY_ITEM_INVALID_EAR_SIDE';
  END IF;

  SELECT p.org_id
    INTO v_patient_org_id
  FROM public.patients p
  WHERE p.id = p_patient_id
    AND p.deleted_at IS NULL;

  IF v_patient_org_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'REPLACE_PATIENT_INVENTORY_ITEM_PATIENT_NOT_FOUND';
  END IF;

  UPDATE public.inventory_items old_i
  SET sold_patient_id = NULL,
      sold_at = NULL,
      ear_side = NULL,
      device_price = NULL,
      status = 'in_stock',
      updated_at = now()
  WHERE old_i.id = p_old_inventory_item_id
    AND old_i.org_id = v_org_id
    AND old_i.deleted_at IS NULL
    AND old_i.status = 'sold'
    AND old_i.sold_patient_id = p_patient_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLACE_PATIENT_INVENTORY_ITEM_OLD_ITEM_NOT_FOUND';
  END IF;

  UPDATE public.inventory_items new_i
  SET sold_patient_id = p_patient_id,
      sold_at = COALESCE(p_sold_at, now()),
      ear_side = p_ear_side,
      device_price = p_device_price,
      status = 'sold',
      updated_at = now()
  WHERE new_i.id = p_new_inventory_item_id
    AND new_i.org_id = v_org_id
    AND new_i.deleted_at IS NULL
    AND new_i.status = 'in_stock'
    AND new_i.sold_patient_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLACE_PATIENT_INVENTORY_ITEM_NEW_ITEM_NOT_AVAILABLE';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_patient_inventory_item(uuid, uuid, uuid, text, timestamptz, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_patient_inventory_item(uuid, uuid, uuid, text, timestamptz, numeric) TO authenticated;
