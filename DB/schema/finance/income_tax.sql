-- DB/schema/finance/income_tax.sql
-- Purpose: Operational income-tax estimate records for sole-proprietorship style tracking.

CREATE TABLE IF NOT EXISTS public.income_tax_brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  tax_year integer NOT NULL,
  lower_bound numeric(14, 2) NOT NULL DEFAULT 0,
  upper_bound numeric(14, 2) NULL,
  rate numeric(5, 2) NOT NULL,
  base_tax numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT income_tax_brackets_rate_check CHECK (rate >= 0 AND rate <= 1),
  CONSTRAINT income_tax_brackets_bounds_check CHECK (
    lower_bound >= 0 AND (upper_bound IS NULL OR upper_bound > lower_bound)
  )
);

CREATE INDEX IF NOT EXISTS income_tax_brackets_lookup_idx
  ON public.income_tax_brackets (org_id, tax_year, lower_bound);

CREATE TABLE IF NOT EXISTS public.monthly_tax_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  tax_year integer NOT NULL,
  tax_month integer NOT NULL,
  crm_revenue numeric(14, 2) NOT NULL DEFAULT 0,
  revenue_adjustment numeric(14, 2) NOT NULL DEFAULT 0,
  salary_expense numeric(14, 2) NOT NULL DEFAULT 0,
  rent_expense numeric(14, 2) NOT NULL DEFAULT 0,
  other_expense numeric(14, 2) NOT NULL DEFAULT 0,
  inventory_cost numeric(14, 2) NOT NULL DEFAULT 0,
  taxable_profit numeric(14, 2) NOT NULL DEFAULT 0,
  cumulative_taxable_profit numeric(14, 2) NOT NULL DEFAULT 0,
  estimated_tax numeric(14, 2) NOT NULL DEFAULT 0,
  notes text NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_tax_records_month_check CHECK (tax_month BETWEEN 1 AND 12),
  CONSTRAINT monthly_tax_records_unique_month UNIQUE (org_id, tax_year, tax_month)
);

ALTER TABLE public.income_tax_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_tax_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS income_tax_brackets_select_by_org ON public.income_tax_brackets;
DROP POLICY IF EXISTS income_tax_brackets_write_admin ON public.income_tax_brackets;
DROP POLICY IF EXISTS income_tax_brackets_insert_admin ON public.income_tax_brackets;
DROP POLICY IF EXISTS income_tax_brackets_update_admin ON public.income_tax_brackets;
DROP POLICY IF EXISTS income_tax_brackets_delete_admin ON public.income_tax_brackets;
DROP POLICY IF EXISTS monthly_tax_records_select_by_org ON public.monthly_tax_records;
DROP POLICY IF EXISTS monthly_tax_records_write_admin ON public.monthly_tax_records;
DROP POLICY IF EXISTS monthly_tax_records_insert_admin ON public.monthly_tax_records;
DROP POLICY IF EXISTS monthly_tax_records_update_admin ON public.monthly_tax_records;
DROP POLICY IF EXISTS monthly_tax_records_delete_admin ON public.monthly_tax_records;

CREATE POLICY income_tax_brackets_select_by_org
ON public.income_tax_brackets
FOR SELECT
TO authenticated
USING (org_id IS NULL OR org_id = public.current_user_org_id());

CREATE POLICY income_tax_brackets_insert_admin
ON public.income_tax_brackets
FOR INSERT
TO authenticated
WITH CHECK (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin');

CREATE POLICY income_tax_brackets_update_admin
ON public.income_tax_brackets
FOR UPDATE
TO authenticated
USING (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin')
WITH CHECK (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin');

CREATE POLICY income_tax_brackets_delete_admin
ON public.income_tax_brackets
FOR DELETE
TO authenticated
USING (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin');

CREATE POLICY monthly_tax_records_select_by_org
ON public.monthly_tax_records
FOR SELECT
TO authenticated
USING (org_id = public.current_user_org_id());

CREATE POLICY monthly_tax_records_insert_admin
ON public.monthly_tax_records
FOR INSERT
TO authenticated
WITH CHECK (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin');

CREATE POLICY monthly_tax_records_update_admin
ON public.monthly_tax_records
FOR UPDATE
TO authenticated
USING (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin')
WITH CHECK (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin');

CREATE POLICY monthly_tax_records_delete_admin
ON public.monthly_tax_records
FOR DELETE
TO authenticated
USING (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin');

REVOKE ALL ON TABLE public.income_tax_brackets FROM anon;
REVOKE ALL ON TABLE public.monthly_tax_records FROM anon;
GRANT SELECT ON TABLE public.income_tax_brackets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.monthly_tax_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.income_tax_brackets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.monthly_tax_records TO service_role;

INSERT INTO public.income_tax_brackets (
  org_id, tax_year, lower_bound, upper_bound, rate, base_tax
)
SELECT null::uuid, 2026, v.lower_bound, v.upper_bound, v.rate, v.base_tax
FROM (VALUES
  (0::numeric, 190000::numeric, 0.15::numeric, 0::numeric),
  (190000::numeric, 400000::numeric, 0.20::numeric, 28500::numeric),
  (400000::numeric, 1000000::numeric, 0.27::numeric, 70500::numeric),
  (1000000::numeric, 5300000::numeric, 0.35::numeric, 232500::numeric),
  (5300000::numeric, null::numeric, 0.40::numeric, 1737500::numeric)
) AS v(lower_bound, upper_bound, rate, base_tax)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.income_tax_brackets b
  WHERE b.org_id IS NULL
    AND b.tax_year = 2026
);
