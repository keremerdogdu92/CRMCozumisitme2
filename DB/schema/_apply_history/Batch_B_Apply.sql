-- ============================================================
-- Batch B Apply: references + reference_gifts + patients + meetings
--               + meeting_payments + meeting_accessories
--               + patient_installment_plans + patient_sale_breakdown
--               + views patient_list_with_device(_all)
--
-- Standard:
-- - Org isolation via public.current_user_org_id()
-- - Admin gating via public.current_user_role()
-- - service_role safety policies for ALL where needed
-- - No profiles subqueries in policies
-- ============================================================

BEGIN;

-- -----------------------------
-- REFERENCES
-- -----------------------------
ALTER TABLE IF EXISTS public.references ENABLE ROW LEVEL SECURITY;

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

-- -----------------------------
-- REFERENCE_GIFTS
-- -----------------------------
ALTER TABLE IF EXISTS public.reference_gifts ENABLE ROW LEVEL SECURITY;

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

-- -----------------------------
-- PATIENTS
-- (as-is helper-based policies already; just ensure deterministic drop+recreate)
-- -----------------------------
ALTER TABLE IF EXISTS public.patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patients_service_full_access ON public.patients;
DROP POLICY IF EXISTS patients_select_by_org ON public.patients;
DROP POLICY IF EXISTS patients_insert_by_org ON public.patients;
DROP POLICY IF EXISTS patients_update_by_org ON public.patients;
DROP POLICY IF EXISTS patients_delete_by_org ON public.patients;

CREATE POLICY patients_service_full_access
ON public.patients
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY patients_select_by_org
ON public.patients
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patients_insert_by_org
ON public.patients
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patients_update_by_org
ON public.patients
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patients_delete_by_org
ON public.patients
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- -----------------------------
-- MEETINGS (already helper-based; just deterministic drop+recreate)
-- -----------------------------
ALTER TABLE IF EXISTS public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meetings_select_by_org_and_type ON public.meetings;
DROP POLICY IF EXISTS meetings_insert_by_org_and_type ON public.meetings;
DROP POLICY IF EXISTS meetings_update_by_org_and_type ON public.meetings;

CREATE POLICY meetings_select_by_org_and_type
ON public.meetings
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
);

CREATE POLICY meetings_insert_by_org_and_type
ON public.meetings
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
);

CREATE POLICY meetings_update_by_org_and_type
ON public.meetings
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
);

-- -----------------------------
-- MEETING_PAYMENTS (convert from profiles subquery -> helper)
-- -----------------------------
ALTER TABLE IF EXISTS public.meeting_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_payments_select_by_org ON public.meeting_payments;
DROP POLICY IF EXISTS meeting_payments_insert_by_org ON public.meeting_payments;
DROP POLICY IF EXISTS meeting_payments_update_by_org ON public.meeting_payments;
DROP POLICY IF EXISTS meeting_payments_service_role_all ON public.meeting_payments;

CREATE POLICY meeting_payments_select_by_org
ON public.meeting_payments
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY meeting_payments_insert_by_org
ON public.meeting_payments
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY meeting_payments_update_by_org
ON public.meeting_payments
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- Optional safety: explicit service_role ALL
CREATE POLICY meeting_payments_service_role_all
ON public.meeting_payments
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- -----------------------------
-- MEETING_ACCESSORIES (convert from profiles subquery -> helper)
-- -----------------------------
ALTER TABLE IF EXISTS public.meeting_accessories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_accessories_select_by_org ON public.meeting_accessories;
DROP POLICY IF EXISTS meeting_accessories_insert_by_org ON public.meeting_accessories;
DROP POLICY IF EXISTS meeting_accessories_update_by_org ON public.meeting_accessories;
DROP POLICY IF EXISTS meeting_accessories_service_role_all ON public.meeting_accessories;

CREATE POLICY meeting_accessories_select_by_org
ON public.meeting_accessories
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY meeting_accessories_insert_by_org
ON public.meeting_accessories
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY meeting_accessories_update_by_org
ON public.meeting_accessories
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- Optional safety: explicit service_role ALL
CREATE POLICY meeting_accessories_service_role_all
ON public.meeting_accessories
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- -----------------------------
-- PATIENT_INSTALLMENT_PLANS (convert from profiles subquery -> helper)
-- -----------------------------
ALTER TABLE IF EXISTS public.patient_installment_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_installment_plans_org_select ON public.patient_installment_plans;
DROP POLICY IF EXISTS patient_installment_plans_org_write ON public.patient_installment_plans;
DROP POLICY IF EXISTS patient_installment_plans_service_role_all ON public.patient_installment_plans;

CREATE POLICY patient_installment_plans_org_select
ON public.patient_installment_plans
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patient_installment_plans_org_write
ON public.patient_installment_plans
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patient_installment_plans_service_role_all
ON public.patient_installment_plans
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- -----------------------------
-- PATIENT_SALE_BREAKDOWN (convert from profiles subquery -> helper)
-- -----------------------------
ALTER TABLE IF EXISTS public.patient_sale_breakdown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_sale_breakdown_select_by_org ON public.patient_sale_breakdown;
DROP POLICY IF EXISTS patient_sale_breakdown_insert_by_org ON public.patient_sale_breakdown;
DROP POLICY IF EXISTS patient_sale_breakdown_update_by_org ON public.patient_sale_breakdown;
DROP POLICY IF EXISTS patient_sale_breakdown_service_role_all ON public.patient_sale_breakdown;

CREATE POLICY patient_sale_breakdown_select_by_org
ON public.patient_sale_breakdown
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patient_sale_breakdown_insert_by_org
ON public.patient_sale_breakdown
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patient_sale_breakdown_update_by_org
ON public.patient_sale_breakdown
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

CREATE POLICY patient_sale_breakdown_service_role_all
ON public.patient_sale_breakdown
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- -----------------------------
-- VIEWS (recreate; RLS enforced by base tables)
-- -----------------------------
CREATE OR REPLACE VIEW public.patient_list_with_device
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
  FROM public.inventory_items AS i
  WHERE i.status = 'sold'::text
    AND i.sold_patient_id IS NOT NULL
  GROUP BY i.org_id, i.sold_patient_id
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
  p.sgk_expected_reimbursement_month,
  p.is_battery_patient,
  p.sgk_recorded_to_system_at
FROM public.patients AS p
LEFT JOIN public."references" AS r ON r.id = p.reference_id
LEFT JOIN device_agg AS da ON da.patient_id = p.id AND da.org_id = p.org_id
WHERE p.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.patient_list_with_device_all
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
  FROM public.inventory_items AS i
  WHERE i.status = 'sold'::text
    AND i.sold_patient_id IS NOT NULL
  GROUP BY i.org_id, i.sold_patient_id
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
  p.sgk_expected_reimbursement_month,
  p.is_battery_patient,
  p.sgk_recorded_to_system_at,
  p.deleted_at,
  p.deleted_by,
  p.delete_reason
FROM public.patients AS p
LEFT JOIN public."references" AS r ON r.id = p.reference_id
LEFT JOIN device_agg AS da ON da.patient_id = p.id AND da.org_id = p.org_id;

COMMIT;
