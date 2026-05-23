-- db/schema/dashboard/dashboard_kpis.rpc.sql
-- Purpose: Org-scoped dashboard KPIs for staff/admin.
-- Staff can read operational KPIs. Admin additionally receives finance KPIs.

drop function if exists public.dashboard_kpis(timestamptz, uuid);

create or replace function public.dashboard_kpis(
  _month_start timestamptz default now(),
  _org_id uuid default null
) returns table (
  "revenueTotal" numeric,
  "sgkEnteredThisMonthTotal" numeric,
  "deviceSgkEnteredThisMonthTotal" numeric,
  "batterySgkEnteredThisMonthTotal" numeric,
  "sgkDueThisMonthTotal" numeric,
  "deviceSgkDueThisMonthTotal" numeric,
  "batterySgkDueThisMonthTotal" numeric,
  "devicesSoldCount" bigint,
  "devicePatientsCount" bigint,
  "cardFeeTotal" numeric,
  "referenceCommissionTotal" numeric,
  "unpaidInstallmentsDueThisMonth" numeric,
  "criticalStockModelCount" bigint,
  "lowStockModelCount" bigint,
  "importErrorJobCount" bigint,
  "inventoryImportErrorRowCount" bigint
) language sql stable
set search_path = public, pg_temp
as $$
with org_ctx as (
  select
    case
      when auth.role() = 'service_role'::text then _org_id
      else (select p.org_id from public.profiles p where p.id = auth.uid())
    end as org_id,
    case
      when auth.role() = 'service_role'::text then true
      else public.current_user_role() = 'admin'
    end as is_admin
), window_bounds as (
  select
    (date_trunc('month', timezone('Europe/Istanbul', coalesce(_month_start, now()))) at time zone 'Europe/Istanbul') as month_start_utc,
    (date_trunc('month', timezone('Europe/Istanbul', coalesce(_month_start, now()))) + interval '1 month') at time zone 'Europe/Istanbul' as month_end_utc,
    (date_trunc('month', timezone('Europe/Istanbul', coalesce(_month_start, now()))))::date as month_start_ist_date,
    (date_trunc('month', timezone('Europe/Istanbul', coalesce(_month_start, now())) + interval '1 month'))::date as month_end_ist_date
), device_sgk as (
  select
    coalesce(sum(coalesce(p.sgk_expected_reimbursement, 0)) filter (
      where p.sgk_recorded_to_system_at >= w.month_start_utc
        and p.sgk_recorded_to_system_at < w.month_end_utc
    ), 0) as entered_total,
    coalesce(sum(coalesce(p.sgk_expected_reimbursement, 0)) filter (
      where p.sgk_expected_reimbursement_month >= w.month_start_ist_date
        and p.sgk_expected_reimbursement_month < w.month_end_ist_date
    ), 0) as due_total
  from public.patients p
  cross join window_bounds w
  cross join org_ctx o
  where o.org_id is not null
    and p.org_id = o.org_id
    and p.deleted_at is null
), battery_sgk as (
  select
    coalesce(sum(coalesce(b.sgk_expected_amount, 0)) filter (
      where b.sgk_rate_effective_date >= w.month_start_ist_date
        and b.sgk_rate_effective_date < w.month_end_ist_date
    ), 0) as entered_total,
    coalesce(sum(coalesce(b.sgk_expected_amount, 0)) filter (
      where b.sgk_expected_reimbursement_month >= w.month_start_ist_date
        and b.sgk_expected_reimbursement_month < w.month_end_ist_date
    ), 0) as due_total
  from public.battery_prescription_deliveries b
  join public.patients p on p.id = b.patient_id and p.deleted_at is null
  cross join window_bounds w
  cross join org_ctx o
  where o.org_id is not null
    and b.org_id = o.org_id
    and b.deleted_at is null
), plan_schedules as (
  select
    pip.org_id,
    pip.patient_id,
    pip.installment_amount,
    gs.installment_index,
    case
      when gs.installment_index = 0 then pip.first_due_date
      else least(
        (date_trunc('month', pip.first_due_date) + (gs.installment_index || ' month')::interval + ((pip.day_of_month - 1) || ' day')::interval)::date,
        (date_trunc('month', pip.first_due_date) + (gs.installment_index || ' month')::interval + interval '1 month - 1 day')::date
      )
    end as due_date
  from public.patient_installment_plans pip
  join org_ctx o on o.org_id is not null and o.org_id = pip.org_id
  join public.patients p on p.id = pip.patient_id and p.deleted_at is null
  cross join generate_series(0, pip.installment_count - 1) as gs(installment_index)
  where pip.status = 'active'
), plan_due as (
  select
    ps.org_id,
    ps.patient_id,
    sum(ps.installment_amount) filter (where ps.due_date < w.month_start_ist_date) as due_before_month,
    sum(ps.installment_amount) filter (
      where ps.due_date >= w.month_start_ist_date
        and ps.due_date < w.month_end_ist_date
    ) as due_this_month,
    coalesce((
      select sum(mp.amount)
      from public.meeting_payments mp
      where mp.org_id = ps.org_id
        and mp.patient_id = ps.patient_id
        and mp.created_at < w.month_end_utc
        and lower(coalesce(mp.method, '')) = 'senet'
    ), 0) as paid_to_month_end
  from plan_schedules ps
  cross join window_bounds w
  group by ps.org_id, ps.patient_id, w.month_start_ist_date, w.month_end_ist_date, w.month_end_utc
), stock_warning_counts as (
  select
    count(*) filter (where w.severity = 'error') as critical_count,
    count(*) filter (where w.severity = 'warning') as low_count
  from public.dashboard_stock_warnings(100000, (select org_id from org_ctx)) w
), inventory_error_jobs as (
  select distinct r.job_id
  from public.inventory_import_rows r
  where r.valid = false
    and r.resolved_at is null
), patient_error_jobs as (
  select distinct r.job_id
  from public.patients_import_rows r
  where r.status = 'error'
), legacy_error_jobs as (
  select distinct r.job_id
  from public.patients_legacy_devices_import_rows r
  where r.status = 'error'
), import_counts as (
  select
    coalesce(count(distinct j.id) filter (
      where j.status = 'failed'
        or coalesce(j.error_count, 0) > 0
        or ie.job_id is not null
        or pe.job_id is not null
        or le.job_id is not null
    ), 0) as import_error_job_count,
    coalesce((
      select count(*)
      from public.inventory_import_rows r
      join public.import_jobs ij on ij.id = r.job_id
      join org_ctx o on o.org_id is not null and o.org_id = ij.org_id
      where ij.deleted_at is null
        and ij.target_entity = 'inventory'
        and r.valid = false
        and r.resolved_at is null
    ), 0) as inventory_import_error_row_count
  from public.import_jobs j
  join org_ctx o on o.org_id is not null and o.org_id = j.org_id
  left join inventory_error_jobs ie on ie.job_id = j.id
  left join patient_error_jobs pe on pe.job_id = j.id
  left join legacy_error_jobs le on le.job_id = j.id
  where j.deleted_at is null
    and j.target_entity in ('inventory', 'patients', 'trials', 'legacy_patient_devices')
)
select
  case when (select is_admin from org_ctx) then coalesce((
    select sum(coalesce(p.sale_total_amount, 0))
    from public.patients p
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and p.org_id = o.org_id
      and p.deleted_at is null
      and p.created_at >= w.month_start_utc
      and p.created_at < w.month_end_utc
  ), 0) else 0 end as "revenueTotal",

  (select entered_total from device_sgk) + (select entered_total from battery_sgk) as "sgkEnteredThisMonthTotal",
  (select entered_total from device_sgk) as "deviceSgkEnteredThisMonthTotal",
  (select entered_total from battery_sgk) as "batterySgkEnteredThisMonthTotal",
  (select due_total from device_sgk) + (select due_total from battery_sgk) as "sgkDueThisMonthTotal",
  (select due_total from device_sgk) as "deviceSgkDueThisMonthTotal",
  (select due_total from battery_sgk) as "batterySgkDueThisMonthTotal",

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

  case when (select is_admin from org_ctx) then coalesce((
    select sum(coalesce(p.card_fee_amount, 0))
    from public.patients p
    cross join window_bounds w
    cross join org_ctx o
    where o.org_id is not null
      and p.org_id = o.org_id
      and p.deleted_at is null
      and p.created_at >= w.month_start_utc
      and p.created_at < w.month_end_utc
  ), 0) else 0 end as "cardFeeTotal",

  case when (select is_admin from org_ctx) then coalesce((
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
  ), 0) else 0 end as "referenceCommissionTotal",

  coalesce((
    select sum(
      greatest(
        0,
        coalesce(pd.due_this_month, 0)
          - greatest(
              0,
              least(
                coalesce(pd.due_this_month, 0),
                coalesce(pd.paid_to_month_end, 0) - coalesce(pd.due_before_month, 0)
              )
            )
      )
    )
    from plan_due pd
  ), 0) as "unpaidInstallmentsDueThisMonth",

  coalesce((select critical_count from stock_warning_counts), 0) as "criticalStockModelCount",
  coalesce((select low_count from stock_warning_counts), 0) as "lowStockModelCount",
  coalesce((select import_error_job_count from import_counts), 0) as "importErrorJobCount",
  coalesce((select inventory_import_error_row_count from import_counts), 0) as "inventoryImportErrorRowCount";
$$;

revoke all on function public.dashboard_kpis(timestamptz, uuid) from public, anon;
grant execute on function public.dashboard_kpis(timestamptz, uuid) to authenticated, service_role;
