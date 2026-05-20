-- DB/schema/inventory/resolve_inventory_import_row.rpc.sql
-- Atomically resolves one failed inventory import row and inserts an inventory item.

CREATE OR REPLACE FUNCTION public.resolve_inventory_import_row(
  p_row_id bigint,
  p_brand text,
  p_model text,
  p_item_type text,
  p_barcode text DEFAULT NULL::text,
  p_serial_no text DEFAULT NULL::text,
  p_status text DEFAULT 'in_stock'::text,
  p_purchase_price numeric DEFAULT NULL::numeric,
  p_list_price numeric DEFAULT NULL::numeric,
  p_purchase_date text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_resolution_note text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_org_id uuid;
  v_item_id uuid;
  v_error_count integer;
BEGIN
  SELECT j.org_id
  INTO v_org_id
  FROM public.inventory_import_rows r
  JOIN public.import_jobs j ON j.id = r.job_id
  WHERE r.id = p_row_id
    AND j.org_id = public.current_user_org_id()
  FOR UPDATE OF r;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Import satiri bulunamadi veya bu organizasyona ait degil.';
  END IF;

  IF btrim(coalesce(p_brand, '')) = '' THEN
    RAISE EXCEPTION 'Marka zorunludur.';
  END IF;

  IF btrim(coalesce(p_model, '')) = '' THEN
    RAISE EXCEPTION 'Model zorunludur.';
  END IF;

  IF p_item_type NOT IN ('hearing_aid', 'charger') THEN
    RAISE EXCEPTION 'Urun tipi hearing_aid veya charger olmalidir.';
  END IF;

  IF btrim(coalesce(p_serial_no, '')) = '' THEN
    RAISE EXCEPTION 'Seri no zorunludur.';
  END IF;

  IF coalesce(p_status, 'in_stock') NOT IN ('in_stock', 'sold', 'repair') THEN
    RAISE EXCEPTION 'Durum in_stock, sold veya repair olmalidir.';
  END IF;

  IF p_purchase_price IS NULL AND p_list_price IS NULL THEN
    RAISE EXCEPTION 'En az bir fiyat gerekli.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inventory_items i
    WHERE i.org_id = v_org_id
      AND i.deleted_at IS NULL
      AND upper(btrim(i.serial_no)) = upper(btrim(p_serial_no))
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_SERIAL: Bu seri no zaten aktif stokta var.';
  END IF;

  INSERT INTO public.inventory_items (
    org_id,
    brand,
    model,
    item_type,
    barcode,
    serial_no,
    ear_side,
    status,
    purchase_price,
    list_price,
    sold_patient_id,
    sold_at
  )
  VALUES (
    v_org_id,
    btrim(p_brand),
    btrim(p_model),
    p_item_type,
    nullif(btrim(coalesce(p_barcode, '')), ''),
    btrim(p_serial_no),
    NULL,
    coalesce(p_status, 'in_stock'),
    p_purchase_price,
    p_list_price,
    NULL,
    NULL
  )
  RETURNING id INTO v_item_id;

  UPDATE public.inventory_import_rows
  SET raw_brand = btrim(p_brand),
      raw_model = btrim(p_model),
      raw_item_type = p_item_type,
      raw_barcode = nullif(btrim(coalesce(p_barcode, '')), ''),
      raw_serial_no = btrim(p_serial_no),
      raw_status = coalesce(p_status, 'in_stock'),
      raw_purchase_price = CASE
        WHEN p_purchase_price IS NULL THEN NULL
        ELSE p_purchase_price::text
      END,
      raw_list_price = CASE
        WHEN p_list_price IS NULL THEN NULL
        ELSE p_list_price::text
      END,
      raw_purchase_date = nullif(btrim(coalesce(p_purchase_date, '')), ''),
      raw_notes = nullif(btrim(coalesce(p_notes, '')), ''),
      valid = TRUE,
      validation_error = NULL,
      resolved_at = now(),
      resolved_by = auth.uid(),
      resolved_inventory_item_id = v_item_id,
      resolution_note = nullif(btrim(coalesce(p_resolution_note, '')), '')
  WHERE id = p_row_id;

  SELECT count(*)
  INTO v_error_count
  FROM public.inventory_import_rows r
  WHERE r.job_id = (
    SELECT job_id FROM public.inventory_import_rows WHERE id = p_row_id
  )
    AND r.valid = FALSE
    AND r.resolved_at IS NULL;

  UPDATE public.import_jobs j
  SET error_count = v_error_count,
      error_message = CASE
        WHEN v_error_count > 0 THEN 'Bazi satirlar hatali; detay icin inventory_import_rows tablosuna bakin.'
        ELSE NULL
      END
  WHERE j.id = (
    SELECT job_id FROM public.inventory_import_rows WHERE id = p_row_id
  )
    AND j.org_id = v_org_id;

  RETURN v_item_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_inventory_import_row(
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.resolve_inventory_import_row(
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text
) FROM anon;

GRANT EXECUTE ON FUNCTION public.resolve_inventory_import_row(
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.resolve_inventory_import_row(
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  text
) TO service_role;
