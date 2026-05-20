-- DB/schema/reports/reports_kpis_v1.rpc.sql
-- Purpose: Supabase RPC to aggregate reports KPIs (org-scoped, Europe/Istanbul month window).
-- Pattern: Same as dashboard_kpis — returns table(...) so Supabase JS client gives data[0] directly.
-- Notes:
--  - Month window: [monthStart 00:00, nextMonthStart 00:00) in Europe/Istanbul.
--  - Excludes soft-deleted rows where deleted_at IS NOT NULL.
--  - Org resolution: authenticated users → profiles.org_id; service_role → null (returns zeros).
--  - revenueByMonth: last 12 months ending with p_month, based on patients.created_at.
--  - totalReceivables: sum of ALL meeting_payments across all time (all methods).

drop function if exists public.reports_kpis_v1(date);

create or replace function public.reports_kpis_v1(
  p_month date default current_date
) returns table (
  "totalReceivables"       numeric,
  "monthlyTaxAmount"       numeric,
  "yearlyTaxAmount"        numeric,
  "firmTotals"             jsonb,
  "totalStockQuantity"     bigint,
  "totalStockCost"         numeric,
  "monthDevicesSoldCount"  bigint,
  "monthDevicesSoldCost"   numeric,
  "monthlyTurnover"        numeric,
  "sgkDueThisMonth"        numeric,
  "sgkEstimatedThisMonth"  numeric,
  "sgkRecordedThisMonth"   numeric,
  "sgkDueNextThreeMonths"  numeric,
  "sgkPaymentRows"         jsonb,
  "revenueByMonth"         jsonb,
  "devicesPie"             jsonb
)
language sql stable
set search_path = ''
as $$
with org_ctx as (
  select case
    when auth.role() = 'service_role'::text then null::uuid
    else (select pr.org_id from public.profiles pr where pr.id = auth.uid())
  end as org_id
),
window_bounds as (
  select
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)) at time zone 'Europe/Istanbul') as month_start_utc,
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)) + interval '1 month') at time zone 'Europe/Istanbul' as month_end_utc,
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)))::date as month_start_ist_date,
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)) + interval '1 month')::date as month_end_ist_date,
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)) - interval '11 months') at time zone 'Europe/Istanbul' as year_start_utc
),
monthly_revenue as (
  select
    to_char(timezone('Europe/Istanbul', pt.created_at), 'YYYY-MM') as month_key,
    to_char(timezone('Europe/Istanbul', pt.created_at), 'MM/YY') as month_label,
    coalesce(sum(pt.sale_total_amount), 0) as total
  from public.patients pt
  cross join window_bounds w
  cross join org_ctx o
  where o.org_id is not null
    and pt.org_id = o.org_id
    and pt.deleted_at is null
    and pt.created_at >= w.year_start_utc
    and pt.created_at < w.month_end_utc
  group by month_key, month_label
  order by month_key
),
device_pie as (
  select
    coalesce(i.brand, 'Bilinmiyor') || ' ' || coalesce(i.model, '') as label,
    count(*)::int as value
  from public.inventory_items i
  cross join window_bounds w
  cross join org_ctx o
  where o.org_id is not null
    and i.org_id = o.org_id
    and i.deleted_at is null
    and i.item_type = 'hearing_aid'
    and i.status = 'sold'
    and i.sold_at >= w.month_start_utc
    and i.sold_at < w.month_end_utc
  group by label
  order by value desc
)
select
  coalesce((
    select sum(mp.amount)
    from public.meeting_payments mp
    cross join org_ctx o
    where o.org_id is not null
      and mp.org_id = o.org_id
      and mp.deleted_at is null
  ), 0) as "totalReceivables",

  coalesce((
    select sum(coalesce(pt.card_fee_amount, 0))
    from public.patients pt
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and pt.org_id = o.org_id
      and pt.deleted_at is null
      and pt.created_at >= w.month_start_utc
      and pt.created_at < w.month_end_utc
  ), 0) as "monthlyTaxAmount",

  coalesce((
    select sum(coalesce(pt.card_fee_amount, 0))
    from public.patients pt
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and pt.org_id = o.org_id
      and pt.deleted_at is null
      and pt.created_at >= w.year_start_utc
      and pt.created_at < w.month_end_utc
  ), 0) as "yearlyTaxAmount",

  (
    select jsonb_build_object(
      'siventosTotal', coalesce(sum(mp.amount) filter (where lower(mp.method) = 'sivantos'), 0),
      'timeTotal',     coalesce(sum(mp.amount) filter (where lower(mp.method) = 'tim'), 0),
      'combinedTotal', coalesce(sum(mp.amount) filter (where lower(mp.method) in ('sivantos', 'tim')), 0)
    )
    from public.meeting_payments mp
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and mp.org_id = o.org_id
      and mp.deleted_at is null
      and mp.created_at >= w.month_start_utc
      and mp.created_at < w.month_end_utc
  ) as "firmTotals",

  coalesce((
    select count(1)
    from public.inventory_items i
    cross join org_ctx o
    where o.org_id is not null
      and i.org_id = o.org_id
      and i.deleted_at is null
      and i.status = 'in_stock'
  ), 0) as "totalStockQuantity",

  coalesce((
    select sum(coalesce(i.purchase_price, 0))
    from public.inventory_items i
    cross join org_ctx o
    where o.org_id is not null
      and i.org_id = o.org_id
      and i.deleted_at is null
      and i.status = 'in_stock'
  ), 0) as "totalStockCost",

  coalesce((
    select count(1)
    from public.inventory_items i
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and i.org_id = o.org_id
      and i.deleted_at is null
      and i.item_type = 'hearing_aid'
      and i.status = 'sold'
      and i.sold_at >= w.month_start_utc
      and i.sold_at < w.month_end_utc
  ), 0) as "monthDevicesSoldCount",

  coalesce((
    select sum(coalesce(i.purchase_price, 0))
    from public.inventory_items i
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and i.org_id = o.org_id
      and i.deleted_at is null
      and i.item_type = 'hearing_aid'
      and i.status = 'sold'
      and i.sold_at >= w.month_start_utc
      and i.sold_at < w.month_end_utc
  ), 0) as "monthDevicesSoldCost",

  coalesce((
    select sum(coalesce(pt.sale_total_amount, 0))
    from public.patients pt
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and pt.org_id = o.org_id
      and pt.deleted_at is null
      and pt.created_at >= w.month_start_utc
      and pt.created_at < w.month_end_utc
  ), 0) as "monthlyTurnover",

  coalesce((
    select sum(coalesce(pt.sgk_expected_reimbursement, 0))
    from public.patients pt
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and pt.org_id = o.org_id
      and pt.deleted_at is null
      and pt.sgk_expected_reimbursement_month >= w.month_start_ist_date
      and pt.sgk_expected_reimbursement_month < w.month_end_ist_date
  ), 0) as "sgkDueThisMonth",

  coalesce((
    select sum(coalesce(pt.sgk_expected_reimbursement, 0))
    from public.patients pt
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and pt.org_id = o.org_id
      and pt.deleted_at is null
      and pt.sgk_flag is true
      and pt.sgk_expected_reimbursement is not null
      and pt.sgk_expected_reimbursement_month >= w.month_start_ist_date
      and pt.sgk_expected_reimbursement_month < w.month_end_ist_date
  ), 0) as "sgkEstimatedThisMonth",

  coalesce((
    select sum(coalesce(pt.sgk_expected_reimbursement, 0))
    from public.patients pt
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and pt.org_id = o.org_id
      and pt.deleted_at is null
      and pt.sgk_flag is true
      and pt.sgk_recorded_to_system is true
      and pt.sgk_recorded_to_system_at is not null
      and pt.sgk_expected_reimbursement is not null
      and pt.sgk_expected_reimbursement_month >= w.month_start_ist_date
      and pt.sgk_expected_reimbursement_month < w.month_end_ist_date
  ), 0) as "sgkRecordedThisMonth",

  coalesce((
    select sum(coalesce(pt.sgk_expected_reimbursement, 0))
    from public.patients pt
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and pt.org_id = o.org_id
      and pt.deleted_at is null
      and pt.sgk_expected_reimbursement_month >= w.month_start_ist_date
      and pt.sgk_expected_reimbursement_month < (w.month_start_ist_date + interval '3 months')::date
  ), 0) as "sgkDueNextThreeMonths",

  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'patient_id', pt.id,
        'patient_name', pt.full_name,
        'sgk_profile', pt.sgk_profile,
        'sgk_profile_label', coalesce(rate.label, pt.sgk_profile),
        'sgk_recorded_to_system', coalesce(pt.sgk_recorded_to_system, false),
        'sgk_recorded_to_system_at', pt.sgk_recorded_to_system_at,
        'sgk_rate_valid_from', coalesce(period.valid_from, pt.sgk_rate_effective_date),
        'sgk_expected_reimbursement_month', pt.sgk_expected_reimbursement_month,
        'sgk_expected_reimbursement', coalesce(pt.sgk_expected_reimbursement, 0),
        'invoice_issued', coalesce(pt.invoice_issued, false),
        'invoice_issued_at', pt.invoice_issued_at
      )
      order by pt.sgk_expected_reimbursement_month asc, pt.full_name asc
    )
    from public.patients pt
    cross join window_bounds w
    cross join org_ctx o
    left join public.sgk_reimbursement_periods period
      on period.id = pt.sgk_rate_period_id
      and period.org_id = pt.org_id
    left join public.sgk_reimbursement_profile_rates rate
      on rate.id = pt.sgk_profile_rate_id
    where o.org_id is not null
      and pt.org_id = o.org_id
      and pt.deleted_at is null
      and pt.sgk_flag is true
      and pt.sgk_expected_reimbursement is not null
      and pt.sgk_expected_reimbursement_month >= w.month_start_ist_date
      and pt.sgk_expected_reimbursement_month < w.month_end_ist_date
  ), '[]'::jsonb) as "sgkPaymentRows",

  coalesce((
    select jsonb_agg(
      jsonb_build_object('monthKey', mr.month_key, 'label', mr.month_label, 'total', mr.total)
      order by mr.month_key
    )
    from monthly_revenue mr
  ), '[]'::jsonb) as "revenueByMonth",

  coalesce((
    select jsonb_agg(
      jsonb_build_object('label', dp.label, 'value', dp.value)
      order by dp.value desc
    )
    from device_pie dp
  ), '[]'::jsonb) as "devicesPie";
$$;

-- Example usage:
-- select * from public.reports_kpis_v1('2026-02-01');

-- Permissions: allow authenticated users and service_role; revoke public/anon.
revoke all on function public.reports_kpis_v1(date) from public, anon;
grant execute on function public.reports_kpis_v1(date) to authenticated, service_role;
