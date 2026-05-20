-- DB/schema/patients/sgk_reimbursements.sql
-- Purpose: Date-based SGK reimbursement periods/rates and patient SGK snapshots.

CREATE TABLE IF NOT EXISTS public.sgk_reimbursement_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  valid_from date NOT NULL,
  pill_extra_per_device numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,
  CONSTRAINT sgk_reimbursement_periods_pkey PRIMARY KEY (id),
  CONSTRAINT sgk_reimbursement_periods_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,
  CONSTRAINT sgk_reimbursement_periods_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT sgk_reimbursement_periods_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT sgk_reimbursement_periods_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT sgk_reimbursement_periods_pill_extra_nonnegative
    CHECK (pill_extra_per_device >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS sgk_reimbursement_periods_org_valid_from_active_idx
ON public.sgk_reimbursement_periods (org_id, valid_from)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS sgk_reimbursement_periods_org_valid_from_idx
ON public.sgk_reimbursement_periods (org_id, valid_from DESC)
WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.sgk_reimbursement_profile_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL,
  profile_id text NOT NULL,
  label text NOT NULL,
  gross numeric(12, 2) NOT NULL,
  net_to_firm numeric(12, 2) NOT NULL,
  employee_share numeric(12, 2) NULL,
  retiree_share numeric(12, 2) NULL,
  retiree_net_after_share numeric(12, 2) NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sgk_reimbursement_profile_rates_pkey PRIMARY KEY (id),
  CONSTRAINT sgk_reimbursement_profile_rates_period_id_fkey
    FOREIGN KEY (period_id) REFERENCES public.sgk_reimbursement_periods (id)
    ON DELETE CASCADE,
  CONSTRAINT sgk_reimbursement_profile_rates_period_profile_unique
    UNIQUE (period_id, profile_id),
  CONSTRAINT sgk_reimbursement_profile_rates_amounts_nonnegative CHECK (
    gross >= 0
    AND net_to_firm >= 0
    AND (employee_share IS NULL OR employee_share >= 0)
    AND (retiree_share IS NULL OR retiree_share >= 0)
    AND (retiree_net_after_share IS NULL OR retiree_net_after_share >= 0)
  )
);

CREATE INDEX IF NOT EXISTS sgk_reimbursement_profile_rates_period_idx
ON public.sgk_reimbursement_profile_rates (period_id);

-- Patient snapshot columns. Existing expected total is preserved.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS sgk_rate_period_id uuid NULL,
  ADD COLUMN IF NOT EXISTS sgk_profile_rate_id uuid NULL,
  ADD COLUMN IF NOT EXISTS sgk_rate_effective_date date NULL,
  ADD COLUMN IF NOT EXISTS sgk_device_count integer NULL,
  ADD COLUMN IF NOT EXISTS sgk_pill_prescription boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sgk_base_reimbursement numeric(12, 2) NULL,
  ADD COLUMN IF NOT EXISTS sgk_pill_extra_amount numeric(12, 2) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'patients_sgk_rate_period_id_fkey'
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_sgk_rate_period_id_fkey
      FOREIGN KEY (sgk_rate_period_id)
      REFERENCES public.sgk_reimbursement_periods (id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'patients_sgk_profile_rate_id_fkey'
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_sgk_profile_rate_id_fkey
      FOREIGN KEY (sgk_profile_rate_id)
      REFERENCES public.sgk_reimbursement_profile_rates (id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'patients_sgk_device_count_check'
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_sgk_device_count_check
      CHECK (sgk_device_count IS NULL OR sgk_device_count IN (1, 2));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS patients_sgk_expected_month_idx
ON public.patients (org_id, sgk_expected_reimbursement_month)
WHERE deleted_at IS NULL AND sgk_flag IS TRUE;

CREATE INDEX IF NOT EXISTS patients_sgk_recorded_at_idx
ON public.patients (org_id, sgk_recorded_to_system_at)
WHERE deleted_at IS NULL AND sgk_recorded_to_system IS TRUE;

-- Seed the 2024-08-13 table for every organization.
WITH seed_periods AS (
  INSERT INTO public.sgk_reimbursement_periods (
    org_id,
    valid_from,
    pill_extra_per_device
  )
  SELECT o.id, DATE '2024-08-13', 624
  FROM public.orgs AS o
  ON CONFLICT (org_id, valid_from) WHERE deleted_at IS NULL
  DO UPDATE
  SET pill_extra_per_device = EXCLUDED.pill_extra_per_device,
      updated_at = now()
  RETURNING id, org_id
),
seed_rates(profile_id, label, gross, net_to_firm, employee_share, retiree_share, retiree_net_after_share) AS (
  VALUES
    ('SGK_0_4_CALISAN', 'SGK 0-4 yas calisan', 7630.56, 6104.45, 1526.11, NULL::numeric, NULL::numeric),
    ('SGK_0_4_EMEKLI', 'SGK 0-4 yas emekli', 7630.56, 7630.56, NULL::numeric, 763.06, 6867.50),
    ('SGK_5_12_CALISAN', 'SGK 5-12 yas calisan', 6782.72, 5426.18, 1356.54, NULL::numeric, NULL::numeric),
    ('SGK_5_12_EMEKLI', 'SGK 5-12 yas emekli', 6782.72, 6782.72, NULL::numeric, 678.27, 6104.45),
    ('SGK_13_18_CALISAN', 'SGK 13-18 yas calisan', 6358.80, 5087.04, 1271.76, NULL::numeric, NULL::numeric),
    ('SGK_13_18_EMEKLI', 'SGK 13-18 yas emekli', 6358.80, 6358.80, NULL::numeric, 635.88, 5722.92),
    ('SGK_YETISKIN_CALISAN', 'SGK yetiskin calisan', 4239.20, 3391.36, 847.84, NULL::numeric, NULL::numeric),
    ('SGK_YETISKIN_EMEKLI', 'SGK yetiskin emekli', 4239.20, 4239.20, NULL::numeric, 423.92, 3815.28)
)
INSERT INTO public.sgk_reimbursement_profile_rates (
  period_id,
  profile_id,
  label,
  gross,
  net_to_firm,
  employee_share,
  retiree_share,
  retiree_net_after_share
)
SELECT
  sp.id,
  sr.profile_id,
  sr.label,
  sr.gross,
  sr.net_to_firm,
  sr.employee_share,
  sr.retiree_share,
  sr.retiree_net_after_share
FROM seed_periods AS sp
CROSS JOIN seed_rates AS sr
ON CONFLICT (period_id, profile_id)
DO UPDATE
SET label = EXCLUDED.label,
    gross = EXCLUDED.gross,
    net_to_firm = EXCLUDED.net_to_firm,
    employee_share = EXCLUDED.employee_share,
    retiree_share = EXCLUDED.retiree_share,
    retiree_net_after_share = EXCLUDED.retiree_net_after_share,
    updated_at = now();

-- Best-effort metadata backfill. Do not change historical total amounts.
UPDATE public.patients AS p
SET sgk_rate_effective_date = COALESCE(
      p.sgk_rate_effective_date,
      COALESCE(p.sgk_recorded_to_system_at::date, p.created_at::date)
    ),
    sgk_device_count = COALESCE(p.sgk_device_count, 1),
    sgk_pill_prescription = COALESCE(p.sgk_pill_prescription, false),
    sgk_base_reimbursement = COALESCE(
      p.sgk_base_reimbursement,
      p.sgk_expected_reimbursement
    ),
    sgk_pill_extra_amount = COALESCE(p.sgk_pill_extra_amount, 0)
WHERE p.sgk_flag IS TRUE
  AND p.deleted_at IS NULL
  AND (
    p.sgk_rate_effective_date IS NULL
    OR p.sgk_device_count IS NULL
    OR p.sgk_base_reimbursement IS NULL
    OR p.sgk_pill_extra_amount IS NULL
  );

-- RLS and grants.
ALTER TABLE public.sgk_reimbursement_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sgk_reimbursement_profile_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sgk_reimbursement_periods_select_by_org
ON public.sgk_reimbursement_periods;
DROP POLICY IF EXISTS sgk_reimbursement_periods_insert_by_org
ON public.sgk_reimbursement_periods;
DROP POLICY IF EXISTS sgk_reimbursement_periods_update_by_org
ON public.sgk_reimbursement_periods;

CREATE POLICY sgk_reimbursement_periods_select_by_org
ON public.sgk_reimbursement_periods
FOR SELECT
TO authenticated
USING (
  org_id = public.current_user_org_id()
  AND deleted_at IS NULL
);

CREATE POLICY sgk_reimbursement_periods_insert_by_org
ON public.sgk_reimbursement_periods
FOR INSERT
TO authenticated
WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY sgk_reimbursement_periods_update_by_org
ON public.sgk_reimbursement_periods
FOR UPDATE
TO authenticated
USING (org_id = public.current_user_org_id())
WITH CHECK (org_id = public.current_user_org_id());

DROP POLICY IF EXISTS sgk_reimbursement_profile_rates_select_by_org
ON public.sgk_reimbursement_profile_rates;
DROP POLICY IF EXISTS sgk_reimbursement_profile_rates_insert_by_org
ON public.sgk_reimbursement_profile_rates;
DROP POLICY IF EXISTS sgk_reimbursement_profile_rates_update_by_org
ON public.sgk_reimbursement_profile_rates;

CREATE POLICY sgk_reimbursement_profile_rates_select_by_org
ON public.sgk_reimbursement_profile_rates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sgk_reimbursement_periods AS p
    WHERE p.id = period_id
      AND p.org_id = public.current_user_org_id()
      AND p.deleted_at IS NULL
  )
);

CREATE POLICY sgk_reimbursement_profile_rates_insert_by_org
ON public.sgk_reimbursement_profile_rates
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sgk_reimbursement_periods AS p
    WHERE p.id = period_id
      AND p.org_id = public.current_user_org_id()
      AND p.deleted_at IS NULL
  )
);

CREATE POLICY sgk_reimbursement_profile_rates_update_by_org
ON public.sgk_reimbursement_profile_rates
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sgk_reimbursement_periods AS p
    WHERE p.id = period_id
      AND p.org_id = public.current_user_org_id()
      AND p.deleted_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sgk_reimbursement_periods AS p
    WHERE p.id = period_id
      AND p.org_id = public.current_user_org_id()
      AND p.deleted_at IS NULL
  )
);

REVOKE ALL ON TABLE public.sgk_reimbursement_periods FROM anon;
REVOKE ALL ON TABLE public.sgk_reimbursement_profile_rates FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.sgk_reimbursement_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.sgk_reimbursement_profile_rates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.sgk_reimbursement_periods TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.sgk_reimbursement_profile_rates TO service_role;

DROP FUNCTION IF EXISTS public.upsert_sgk_reimbursement_period(date, numeric, jsonb);

CREATE OR REPLACE FUNCTION public.upsert_sgk_reimbursement_period(
  p_valid_from date,
  p_pill_extra_per_device numeric,
  p_rates jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_org_id uuid;
  v_period_id uuid;
  v_rate jsonb;
  v_rate_count integer := 0;
BEGIN
  v_org_id := public.current_user_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'UPSERT_SGK_REIMBURSEMENT_PERIOD_NO_ORG';
  END IF;

  IF p_valid_from IS NULL THEN
    RAISE EXCEPTION 'UPSERT_SGK_REIMBURSEMENT_PERIOD_VALID_FROM_REQUIRED';
  END IF;

  IF p_pill_extra_per_device IS NULL OR p_pill_extra_per_device < 0 THEN
    RAISE EXCEPTION 'UPSERT_SGK_REIMBURSEMENT_PERIOD_INVALID_PILL_EXTRA';
  END IF;

  INSERT INTO public.sgk_reimbursement_periods (
    org_id,
    valid_from,
    pill_extra_per_device,
    created_by,
    updated_by
  )
  VALUES (
    v_org_id,
    p_valid_from,
    round(p_pill_extra_per_device, 2),
    auth.uid(),
    auth.uid()
  )
  ON CONFLICT (org_id, valid_from) WHERE deleted_at IS NULL
  DO UPDATE
  SET pill_extra_per_device = EXCLUDED.pill_extra_per_device,
      updated_at = now(),
      updated_by = auth.uid()
  RETURNING id INTO v_period_id;

  FOR v_rate IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_rates, '[]'::jsonb))
  LOOP
    IF COALESCE(v_rate->>'profile_id', '') = '' THEN
      RAISE EXCEPTION 'UPSERT_SGK_REIMBURSEMENT_PERIOD_PROFILE_ID_REQUIRED';
    END IF;

    INSERT INTO public.sgk_reimbursement_profile_rates (
      period_id,
      profile_id,
      label,
      gross,
      net_to_firm,
      employee_share,
      retiree_share,
      retiree_net_after_share
    )
    VALUES (
      v_period_id,
      v_rate->>'profile_id',
      COALESCE(NULLIF(v_rate->>'label', ''), v_rate->>'profile_id'),
      round(COALESCE(NULLIF(v_rate->>'gross', '')::numeric, 0), 2),
      round(COALESCE(NULLIF(v_rate->>'net_to_firm', '')::numeric, 0), 2),
      round(NULLIF(v_rate->>'employee_share', '')::numeric, 2),
      round(NULLIF(v_rate->>'retiree_share', '')::numeric, 2),
      round(NULLIF(v_rate->>'retiree_net_after_share', '')::numeric, 2)
    )
    ON CONFLICT (period_id, profile_id)
    DO UPDATE
    SET label = EXCLUDED.label,
        gross = EXCLUDED.gross,
        net_to_firm = EXCLUDED.net_to_firm,
        employee_share = EXCLUDED.employee_share,
        retiree_share = EXCLUDED.retiree_share,
        retiree_net_after_share = EXCLUDED.retiree_net_after_share,
        updated_at = now();

    v_rate_count := v_rate_count + 1;
  END LOOP;

  IF v_rate_count = 0 THEN
    RAISE EXCEPTION 'UPSERT_SGK_REIMBURSEMENT_PERIOD_RATES_REQUIRED';
  END IF;

  RETURN v_period_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_sgk_reimbursement_period(date, numeric, jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_sgk_reimbursement_period(date, numeric, jsonb)
TO authenticated;

DROP FUNCTION IF EXISTS public.sgk_payment_tracking(date);

CREATE OR REPLACE FUNCTION public.sgk_payment_tracking(
  p_month date DEFAULT current_date
)
RETURNS TABLE (
  patient_id uuid,
  patient_name text,
  sgk_profile text,
  sgk_profile_label text,
  sgk_recorded_to_system boolean,
  sgk_recorded_to_system_at timestamptz,
  sgk_rate_valid_from date,
  sgk_expected_reimbursement_month date,
  sgk_expected_reimbursement numeric,
  invoice_issued boolean,
  invoice_issued_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
WITH org_ctx AS (
  SELECT public.current_user_org_id() AS org_id
),
month_bounds AS (
  SELECT
    date_trunc('month', p_month)::date AS month_start,
    (date_trunc('month', p_month) + interval '1 month')::date AS month_end
)
SELECT
  pt.id AS patient_id,
  pt.full_name AS patient_name,
  pt.sgk_profile,
  COALESCE(rate.label, pt.sgk_profile) AS sgk_profile_label,
  COALESCE(pt.sgk_recorded_to_system, false) AS sgk_recorded_to_system,
  pt.sgk_recorded_to_system_at,
  COALESCE(period.valid_from, pt.sgk_rate_effective_date) AS sgk_rate_valid_from,
  pt.sgk_expected_reimbursement_month,
  COALESCE(pt.sgk_expected_reimbursement, 0) AS sgk_expected_reimbursement,
  COALESCE(pt.invoice_issued, false) AS invoice_issued,
  pt.invoice_issued_at
FROM public.patients AS pt
CROSS JOIN org_ctx AS o
CROSS JOIN month_bounds AS m
LEFT JOIN public.sgk_reimbursement_periods AS period
  ON period.id = pt.sgk_rate_period_id
  AND period.org_id = pt.org_id
LEFT JOIN public.sgk_reimbursement_profile_rates AS rate
  ON rate.id = pt.sgk_profile_rate_id
WHERE o.org_id IS NOT NULL
  AND pt.org_id = o.org_id
  AND pt.deleted_at IS NULL
  AND pt.sgk_flag IS TRUE
  AND pt.sgk_expected_reimbursement IS NOT NULL
  AND pt.sgk_expected_reimbursement_month >= m.month_start
  AND pt.sgk_expected_reimbursement_month < m.month_end
ORDER BY pt.sgk_expected_reimbursement_month ASC, pt.full_name ASC;
$function$;

REVOKE ALL ON FUNCTION public.sgk_payment_tracking(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sgk_payment_tracking(date) TO authenticated;
