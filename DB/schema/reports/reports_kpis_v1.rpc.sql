-- DB/schema/reports/reports_kpis_v1.rpc.sql
-- Purpose: Admin-only reporting KPIs with device SGK + battery SGK breakdowns.

drop function if exists public.reports_kpis_v1(date);

create or replace function public.reports_kpis_v1(
  p_month date default current_date
) returns table (
  "totalReceivables" numeric,
  "monthlyTaxAmount" numeric,
  "yearlyTaxAmount" numeric,
  "firmTotals" jsonb,
  "totalStockQuantity" bigint,
  "totalStockCost" numeric,
  "monthDevicesSoldCount" bigint,
  "monthDevicesSoldCost" numeric,
  "monthlyTurnover" numeric,
  "sgkDueThisMonth" numeric,
  "sgkDeviceDueThisMonth" numeric,
  "sgkBatteryDueThisMonth" numeric,
  "sgkEstimatedThisMonth" numeric,
  "sgkRecordedThisMonth" numeric,
  "sgkDeviceRecordedThisMonth" numeric,
  "sgkBatteryRecordedThisMonth" numeric,
  "sgkDueNextThreeMonths" numeric,
  "sgkPaymentRows" jsonb,
  "revenueByMonth" jsonb,
  "devicesPie" jsonb
)
language sql stable
set search_path = ''
as $$
with org_ctx as (
  select
    case
      when auth.role() = 'service_role'::text then null::uuid
      else public.current_user_org_id()
    end as org_id
  where public.require_current_user_admin()
),
window_bounds as (
  select
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)) at time zone 'Europe/Istanbul') as month_start_utc,
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)) + interval '1 month') at time zone 'Europe/Istanbul' as month_end_utc,
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)))::date as month_start_ist_date,
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)) + interval '1 month')::date as month_end_ist_date,
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)) - interval '11 months') at time zone 'Europe/Istanbul' as year_start_utc
),
device_sgk as (
  select
    coalesce(sum(coalesce(pt.sgk_expected_reimbursement, 0)) filter (
      where pt.sgk_expected_reimbursement_month >= w.month_start_ist_date
        and pt.sgk_expected_reimbursement_month < w.month_end_ist_date
    ), 0) as due_total,
    coalesce(sum(coalesce(pt.sgk_expected_reimbursement, 0)) filter (
      where pt.sgk_recorded_to_system is true
        and pt.sgk_recorded_to_system_at >= w.month_start_utc
        and pt.sgk_recorded_to_system_at < w.month_end_utc
    ), 0) as recorded_total,
    coalesce(sum(coalesce(pt.sgk_expected_reimbursement, 0)) filter (
      where pt.sgk_expected_reimbursement_month >= w.month_start_ist_date
        and pt.sgk_expected_reimbursement_month < (w.month_start_ist_date + interval '3 months')::date
    ), 0) as due_next_three_total
  from public.patients pt
  cross join window_bounds w
  cross join org_ctx o
  where o.org_id is not null
    and pt.org_id = o.org_id
    and pt.deleted_at is null
    and pt.sgk_flag is true
),
battery_sgk as (
  select
    coalesce(sum(coalesce(b.sgk_expected_amount, 0)) filter (
      where b.sgk_expected_reimbursement_month >= w.month_start_ist_date
        and b.sgk_expected_reimbursement_month < w.month_end_ist_date
    ), 0) as due_total,
    coalesce(sum(coalesce(b.sgk_expected_amount, 0)) filter (
      where b.sgk_rate_effective_date >= w.month_start_ist_date
        and b.sgk_rate_effective_date < w.month_end_ist_date
    ), 0) as recorded_total,
    coalesce(sum(coalesce(b.sgk_expected_amount, 0)) filter (
      where b.sgk_expected_reimbursement_month >= w.month_start_ist_date
        and b.sgk_expected_reimbursement_month < (w.month_start_ist_date + interval '3 months')::date
    ), 0) as due_next_three_total
  from public.battery_prescription_deliveries b
  join public.patients pt on pt.id = b.patient_id and pt.deleted_at is null
  cross join window_bounds w
  cross join org_ctx o
  where o.org_id is not null
    and b.org_id = o.org_id
    and b.deleted_at is null
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
),
sgk_rows as (
  select
    'device:' || pt.id::text as row_id,
    'device'::text as source,
    null::uuid as battery_delivery_id,
    pt.id as patient_id,
    pt.full_name as patient_name,
    pt.sgk_profile,
    coalesce(rate.label, pt.sgk_profile) as sgk_profile_label,
    coalesce(pt.sgk_recorded_to_system, false) as sgk_recorded_to_system,
    pt.sgk_recorded_to_system_at,
    coalesce(period.valid_from, pt.sgk_rate_effective_date) as sgk_rate_valid_from,
    pt.sgk_expected_reimbursement_month,
    coalesce(pt.sgk_expected_reimbursement, 0) as sgk_expected_reimbursement,
    coalesce(pt.invoice_issued, false) as invoice_issued,
    pt.invoice_issued_at
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

  union all

  select
    'battery:' || b.id::text as row_id,
    'battery'::text as source,
    b.id as battery_delivery_id,
    pt.id as patient_id,
    pt.full_name as patient_name,
    null::text as sgk_profile,
    'Pil SGK'::text as sgk_profile_label,
    (b.sgk_rate_effective_date is not null) as sgk_recorded_to_system,
    b.sgk_rate_effective_date::timestamptz as sgk_recorded_to_system_at,
    coalesce(period.valid_from, b.sgk_rate_effective_date) as sgk_rate_valid_from,
    b.sgk_expected_reimbursement_month,
    coalesce(b.sgk_expected_amount, 0) as sgk_expected_reimbursement,
    coalesce(pt.invoice_issued, false) as invoice_issued,
    pt.invoice_issued_at
  from public.battery_prescription_deliveries b
  join public.patients pt on pt.id = b.patient_id and pt.deleted_at is null
  cross join window_bounds w
  cross join org_ctx o
  left join public.sgk_reimbursement_periods period
    on period.id = b.sgk_rate_period_id
    and period.org_id = b.org_id
  where o.org_id is not null
    and b.org_id = o.org_id
    and b.deleted_at is null
    and b.sgk_expected_amount is not null
    and b.sgk_expected_reimbursement_month >= w.month_start_ist_date
    and b.sgk_expected_reimbursement_month < w.month_end_ist_date
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
      'timeTotal', coalesce(sum(mp.amount) filter (where lower(mp.method) = 'tim'), 0),
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

  (select due_total from device_sgk) + (select due_total from battery_sgk) as "sgkDueThisMonth",
  (select due_total from device_sgk) as "sgkDeviceDueThisMonth",
  (select due_total from battery_sgk) as "sgkBatteryDueThisMonth",
  (select due_total from device_sgk) + (select due_total from battery_sgk) as "sgkEstimatedThisMonth",
  (select recorded_total from device_sgk) + (select recorded_total from battery_sgk) as "sgkRecordedThisMonth",
  (select recorded_total from device_sgk) as "sgkDeviceRecordedThisMonth",
  (select recorded_total from battery_sgk) as "sgkBatteryRecordedThisMonth",
  (select due_next_three_total from device_sgk) + (select due_next_three_total from battery_sgk) as "sgkDueNextThreeMonths",

  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'row_id', r.row_id,
        'source', r.source,
        'battery_delivery_id', r.battery_delivery_id,
        'patient_id', r.patient_id,
        'patient_name', r.patient_name,
        'sgk_profile', r.sgk_profile,
        'sgk_profile_label', r.sgk_profile_label,
        'sgk_recorded_to_system', r.sgk_recorded_to_system,
        'sgk_recorded_to_system_at', r.sgk_recorded_to_system_at,
        'sgk_rate_valid_from', r.sgk_rate_valid_from,
        'sgk_expected_reimbursement_month', r.sgk_expected_reimbursement_month,
        'sgk_expected_reimbursement', r.sgk_expected_reimbursement,
        'invoice_issued', r.invoice_issued,
        'invoice_issued_at', r.invoice_issued_at
      )
      order by r.sgk_expected_reimbursement_month asc, r.patient_name asc, r.source asc
    )
    from sgk_rows r
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

revoke all on function public.reports_kpis_v1(date) from public, anon;
grant execute on function public.reports_kpis_v1(date) to authenticated, service_role;
