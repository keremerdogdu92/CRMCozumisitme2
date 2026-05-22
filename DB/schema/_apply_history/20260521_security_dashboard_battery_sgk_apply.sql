-- 2026-05-21
-- Applied to Supabase project sljxmsydtnnvimbslarp.
--
-- Scope:
-- - admin guard helper: public.require_current_user_admin()
-- - battery_prescription_deliveries SGK snapshot columns
-- - dashboard_kpis / dashboard_upcoming_meetings refresh
-- - reports_kpis_v1 SGK device+battery breakdown refresh
-- - sgk_payment_tracking battery rows + admin guard
-- - upsert_sgk_reimbursement_period admin guard
-- - device_catalog_import_rows anon/authenticated lock-down
--
-- Canonical definitions live in:
-- - DB/schema/core/profiles.sql
-- - DB/schema/patients/battery_prescription_deliveries.sql
-- - DB/schema/patients/sgk_reimbursements.sql
-- - DB/schema/dashboard/dashboard_kpis.rpc.sql
-- - DB/schema/dashboard/dashboard_upcoming_meetings.rpc.sql
-- - DB/schema/reports/reports_kpis_v1.rpc.sql

-- Live-only legacy table hardening. This table is not part of the current app
-- code path and does not have org_id, so authenticated access is revoked.
do $$
begin
  if to_regclass('public.device_catalog_import_rows') is not null then
    execute 'alter table public.device_catalog_import_rows enable row level security';
    execute 'revoke all on table public.device_catalog_import_rows from anon';
    execute 'revoke all on table public.device_catalog_import_rows from authenticated';
    execute 'grant select, insert, update, delete, truncate, references, trigger on table public.device_catalog_import_rows to service_role';
    execute 'drop policy if exists device_catalog_import_rows_service_full_access on public.device_catalog_import_rows';
    execute 'create policy device_catalog_import_rows_service_full_access on public.device_catalog_import_rows as permissive for all to public using (auth.role() = ''service_role''::text) with check (auth.role() = ''service_role''::text)';
  end if;
end;
$$;

drop function if exists public._ensure_soft_delete_columns(regclass);
revoke execute on all functions in schema public from anon;
