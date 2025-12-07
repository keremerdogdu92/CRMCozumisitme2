-- db/schema/patients/patient_list_with_device.view.sql
-- Purpose: View definition for `patient_list_with_device`.
-- Combines patients with their sold devices and reference info for listing screens.
-- Includes: CREATE VIEW with internal CTE aggregation over inventory_items.
-- Source of truth: Supabase view definition.
--
-- Security:
--   - security_invoker = on → view runs with caller's permissions,
--     so RLS on patients / inventory_items / references is enforced.

CREATE VIEW public.patient_list_with_device
WITH (security_invoker = on) AS
WITH device_agg AS (
  SELECT
    i.org_id,
    i.sold_patient_id AS patient_id,
    MIN(i.brand) AS device_brand,
    MIN(i.model) AS device_model,
    SUM(COALESCE(i.list_price, 0::numeric))::numeric(12, 2) AS device_total_price,
    CASE
      WHEN COUNT(*) FILTER (WHERE i.ear_side = 'right'::text) > 0
       AND COUNT(*) FILTER (WHERE i.ear_side = 'left'::text) > 0
        THEN 'bilateral'::text
      WHEN COUNT(*) FILTER (WHERE i.ear_side = 'right'::text) > 0
        THEN 'right'::text
      WHEN COUNT(*) FILTER (WHERE i.ear_side = 'left'::text) > 0
        THEN 'left'::text
      ELSE NULL::text
    END AS device_ear_side_summary
  FROM
    public.inventory_items AS i
  WHERE
    i.status = 'sold'::text
  GROUP BY
    i.org_id,
    i.sold_patient_id
)
SELECT
  p.org_id,
  p.id,
  p.full_name,
  p.phone,
  p.created_at,
  p.last_visit_at,
  p.sgk_flag,
  p.sgk_prescription_no,
  p.sgk_docs_received,
  p.sgk_processed,
  p.satisfaction_10,
  p.sgk_prescription_received,
  p.sgk_recorded_to_system,
  p.national_id,
  p.address,
  p.kin_phone,
  p.reference_id,
  p.archive_code,
  p.payment_method,
  p.sale_total_amount,
  p.card_fee_rate,
  p.card_fee_amount,
  p.invoice_issued,
  p.invoice_issued_at,
  r.full_name AS reference_name,
  r.phone AS reference_phone,
  da.device_brand,
  da.device_model,
  da.device_total_price,
  da.device_ear_side_summary,
  p.sgk_profile,
  p.sgk_expected_reimbursement,
  p.sgk_expected_reimbursement_month
FROM
  public.patients AS p
  LEFT JOIN public."references" AS r
    ON r.id = p.reference_id
  LEFT JOIN device_agg AS da
    ON da.patient_id = p.id
   AND da.org_id = p.org_id;

-- NOTE:
-- - RLS is enforced on the underlying tables (patients, inventory_items, references),
--   not on the view itself. This view should not have its own RLS policies.
