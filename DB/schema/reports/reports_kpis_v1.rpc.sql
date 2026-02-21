-- DB/schema/reports/reports_kpis_v1.rpc.sql
-- Purpose: Supabase RPC to aggregate reports KPIs (org-scoped, Europe/Istanbul month window).
-- Scope: totalReceivables, monthlyTaxAmount, yearlyTaxAmount, firmTotals, stock, devices,
--        monthlyTurnover, sgkDueThisMonth, sgkDueNextThreeMonths, revenueByMonth, devicesPie.
-- Notes:
--  - Month window: [monthStart 00:00, nextMonthStart 00:00) in Europe/Istanbul.
--  - Excludes soft-deleted rows where deleted_at IS NOT NULL.
--  - Org resolution: authenticated users → profiles.org_id; service_role returns zeros (no org_id param).
--  - revenueByMonth: last 12 months ending with p_month, based on patients.created_at.
--  - totalReceivables: sum of ALL meeting_payments across all time (all methods).

create or replace function public.reports_kpis_v1(
  p_month date default current_date  -- any date within the target month, e.g. '2025-02-01'
) returns jsonb
language sql stable
security invoker
as $$
with org_ctx as (
  select case
    when auth.role() = 'service_role'::text then null::uuid
    else (select pr.org_id from public.profiles pr where pr.id = auth.uid())
  end as org_id
),
window_bounds as (
  select
    -- Selected month boundaries (UTC) using Europe/Istanbul
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)) at time zone 'Europe/Istanbul') as month_start_utc,
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)) + interval '1 month') at time zone 'Europe/Istanbul' as month_end_utc,
    -- Date boundaries for date-only comparisons (sgk_expected_reimbursement_month)
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)))::date as month_start_ist_date,
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)) + interval '1 month')::date as month_end_ist_date,
    -- 12-month window for yearly aggregations (12 months back from start of selected month)
    (date_trunc('month', timezone('Europe/Istanbul', p_month::timestamptz)) - interval '11 months') at time zone 'Europe/Istanbul' as year_start_utc
),
-- Monthly revenue for the last 12 months ending with p_month (bar chart data)
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
-- Device pie chart for selected month (brand + model distribution)
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
select jsonb_build_object(
  -- Toplam alacaklar: tüm zamanlar, tüm ödeme yöntemleri
  'totalReceivables', coalesce((
    select sum(mp.amount)
    from public.meeting_payments mp
    cross join org_ctx o
    where o.org_id is not null
      and mp.org_id = o.org_id
      and mp.deleted_at is null
  ), 0),

  -- Aylık vergi (card fee): seçili ayda oluşturulan hastalar
  'monthlyTaxAmount', coalesce((
    select sum(coalesce(pt.card_fee_amount, 0))
    from public.patients pt
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and pt.org_id = o.org_id
      and pt.deleted_at is null
      and pt.created_at >= w.month_start_utc
      and pt.created_at < w.month_end_utc
  ), 0),

  -- Yıllık vergi (card fee): son 12 ayda oluşturulan hastalar
  'yearlyTaxAmount', coalesce((
    select sum(coalesce(pt.card_fee_amount, 0))
    from public.patients pt
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and pt.org_id = o.org_id
      and pt.deleted_at is null
      and pt.created_at >= w.year_start_utc
      and pt.created_at < w.month_end_utc
  ), 0),

  -- Firmalara çekilen tutarlar (seçili aydaki meeting_payments)
  'firmTotals', (
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
  ),

  -- Stoktaki cihaz adedi (in_stock, silinmemiş)
  'totalStockQuantity', coalesce((
    select count(1)
    from public.inventory_items i
    cross join org_ctx o
    where o.org_id is not null
      and i.org_id = o.org_id
      and i.deleted_at is null
      and i.status = 'in_stock'
  ), 0),

  -- Stoktaki cihazların toplam maliyeti
  'totalStockCost', coalesce((
    select sum(coalesce(i.purchase_price, 0))
    from public.inventory_items i
    cross join org_ctx o
    where o.org_id is not null
      and i.org_id = o.org_id
      and i.deleted_at is null
      and i.status = 'in_stock'
  ), 0),

  -- Seçili ayda satılan hearing_aid adedi
  'monthDevicesSoldCount', coalesce((
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
  ), 0),

  -- Seçili ayda satılan cihazların toplam maliyeti (purchase_price)
  'monthDevicesSoldCost', coalesce((
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
  ), 0),

  -- Aylık ciro: seçili ayda oluşturulan hastalar için sale_total_amount toplamı
  'monthlyTurnover', coalesce((
    select sum(coalesce(pt.sale_total_amount, 0))
    from public.patients pt
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and pt.org_id = o.org_id
      and pt.deleted_at is null
      and pt.created_at >= w.month_start_utc
      and pt.created_at < w.month_end_utc
  ), 0),

  -- Bu ay SGK'dan yatması beklenen tutar (sgk_expected_reimbursement_month = seçili ay)
  'sgkDueThisMonth', coalesce((
    select sum(coalesce(pt.sgk_expected_reimbursement, 0))
    from public.patients pt
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and pt.org_id = o.org_id
      and pt.deleted_at is null
      and pt.sgk_expected_reimbursement_month >= w.month_start_ist_date
      and pt.sgk_expected_reimbursement_month < w.month_end_ist_date
  ), 0),

  -- Önümüzdeki 3 ay SGK toplamı (seçili ay dahil +3 ay)
  'sgkDueNextThreeMonths', coalesce((
    select sum(coalesce(pt.sgk_expected_reimbursement, 0))
    from public.patients pt
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and pt.org_id = o.org_id
      and pt.deleted_at is null
      and pt.sgk_expected_reimbursement_month >= w.month_start_ist_date
      and pt.sgk_expected_reimbursement_month < (w.month_start_ist_date + interval '3 months')::date
  ), 0),

  -- 12 aylık ciro grafiği (bar chart) — JSON array of MonthlyRevenuePoint
  'revenueByMonth', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'monthKey', mr.month_key,
        'label',    mr.month_label,
        'total',    mr.total
      ) order by mr.month_key
    )
    from monthly_revenue mr
  ), '[]'::jsonb),

  -- Seçili ayda satılan cihazların marka-model dağılımı (pie chart) — JSON array of PieSlice
  'devicesPie', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'label', dp.label,
        'value', dp.value
      ) order by dp.value desc
    )
    from device_pie dp
  ), '[]'::jsonb)
);
$$;

-- Example usage:
-- select public.reports_kpis_v1('2025-02-01');

-- Permissions: allow authenticated users and service_role; revoke public/anon.
revoke all on function public.reports_kpis_v1(date) from public, anon;
grant execute on function public.reports_kpis_v1(date) to authenticated, service_role;
