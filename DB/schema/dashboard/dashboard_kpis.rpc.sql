-- db/schema/dashboard/dashboard_kpis.rpc.sql
-- Purpose: Supabase RPC to aggregate dashboard KPIs (org-scoped, Europe/Istanbul month window).
-- Scope: revenueTotal, sgkEnteredThisMonthTotal, sgkDueThisMonthTotal, devicesSoldCount,
--        devicePatientsCount, cardFeeTotal, referenceCommissionTotal.
-- Notes:
--  - Month window: [monthStart 00:00, nextMonthStart 00:00) in Europe/Istanbul.
--  - Excludes soft-deleted rows where deleted_at exists (patients, inventory_items).
--  - Uses explicit KPI sources per product spec; no installment FIFO/senet math here.
--  - Org resolution:
--      * service_role: may pass _org_id; if null, results are zeroed.
--      * authenticated users: org_id is derived from profiles.id = auth.uid(); _org_id param is ignored.
--      * if org cannot be resolved, the function returns zeros.

create or replace function public.dashboard_kpis(
  _month_start timestamptz default now(), -- evaluated in Europe/Istanbul below
  _org_id uuid default null               -- only used when auth.role() = 'service_role'
) returns table (
  revenueTotal numeric,
  sgkEnteredThisMonthTotal numeric,
  sgkDueThisMonthTotal numeric,
  devicesSoldCount bigint,
  devicePatientsCount bigint,
  cardFeeTotal numeric,
  referenceCommissionTotal numeric
) language sql stable as $$
with org_ctx as (
  select case
    when auth.role() = 'service_role'::text then _org_id
    else (select p.org_id from public.profiles p where p.id = auth.uid())
  end as org_id
), window_bounds as (
  select
    -- Align provided timestamp to Europe/Istanbul month start 00:00, then convert back to UTC for comparisons.
    (date_trunc('month', timezone('Europe/Istanbul', coalesce(_month_start, now()))) at time zone 'Europe/Istanbul') as month_start_utc,
    (date_trunc('month', timezone('Europe/Istanbul', coalesce(_month_start, now()))) + interval '1 month') at time zone 'Europe/Istanbul' as month_end_utc,
    -- Date boundaries in Europe/Istanbul for date-only comparisons (e.g., sgk_expected_reimbursement_month).
    (date_trunc('month', timezone('Europe/Istanbul', coalesce(_month_start, now()))))::date as month_start_ist_date,
    (date_trunc('month', timezone('Europe/Istanbul', coalesce(_month_start, now())) + interval '1 month'))::date as month_end_ist_date
)
select
  -- revenueTotal: sum of patients.sale_total_amount for patients created in the month window.
  coalesce((
    select sum(coalesce(p.sale_total_amount, 0))
    from public.patients p
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and p.org_id = o.org_id
      and p.deleted_at is null
      and p.created_at >= w.month_start_utc
      and p.created_at < w.month_end_utc
  ), 0) as "revenueTotal",

  -- sgkEnteredThisMonthTotal: sum of expected SGK reimbursements for patients recorded this month.
  coalesce((
    select sum(coalesce(p.sgk_expected_reimbursement, 0))
    from public.patients p
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and p.org_id = o.org_id
      and p.deleted_at is null
      and p.sgk_recorded_to_system_at >= w.month_start_utc
      and p.sgk_recorded_to_system_at < w.month_end_utc
  ), 0) as "sgkEnteredThisMonthTotal",

  -- sgkDueThisMonthTotal: sum of expected SGK reimbursements whose expected month falls in the window.
  coalesce((
    select sum(coalesce(p.sgk_expected_reimbursement, 0))
    from public.patients p
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and p.org_id = o.org_id
      and p.deleted_at is null
      and p.sgk_expected_reimbursement_month >= w.month_start_ist_date
      and p.sgk_expected_reimbursement_month < w.month_end_ist_date
  ), 0) as "sgkDueThisMonthTotal",

  -- devicesSoldCount: hearing aid inventory items sold in the month window.
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
  ), 0) as "devicesSoldCount",

  -- devicePatientsCount: distinct patients who purchased devices in the month window.
  coalesce((
    select count(distinct i.sold_patient_id)
    from public.inventory_items i
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and i.org_id = o.org_id
      and i.deleted_at is null
      and i.item_type = 'hearing_aid'
      and i.status = 'sold'
      and i.sold_patient_id is not null
      and i.sold_at >= w.month_start_utc
      and i.sold_at < w.month_end_utc
  ), 0) as "devicePatientsCount",

  -- cardFeeTotal: sum of card fee amounts for patients created in the month window.
  coalesce((
    select sum(coalesce(p.card_fee_amount, 0))
    from public.patients p
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and p.org_id = o.org_id
      and p.deleted_at is null
      and p.created_at >= w.month_start_utc
      and p.created_at < w.month_end_utc
  ), 0) as "cardFeeTotal",

  -- referenceCommissionTotal: commission owed for patients with a reference, using the sale month window.
  coalesce((
    select sum(
      case
        when r.commission_scheme = 'percent' then coalesce(p.sale_total_amount, 0) * coalesce(r.commission_percent, 0) / 100
        when r.commission_scheme = 'fixed' then coalesce(r.commission_fixed, 0)
        else 0
      end
    )
    from public.patients p
    join public."references" r on r.id = p.reference_id
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and p.org_id = o.org_id
      and r.org_id = o.org_id
      and p.deleted_at is null
      and p.created_at >= w.month_start_utc
      and p.created_at < w.month_end_utc
  ), 0) as "referenceCommissionTotal";
$$;

-- Example usage:
-- select * from public.dashboard_kpis(_org_id := '<org-uuid>', _month_start := '2025-02-01T00:00:00+03');

-- Permissions: allow authenticated users; keep service_role; revoke public/anon.
revoke all on function public.dashboard_kpis(timestamptz, uuid) from public, anon;
grant execute on function public.dashboard_kpis(timestamptz, uuid) to authenticated, service_role;
