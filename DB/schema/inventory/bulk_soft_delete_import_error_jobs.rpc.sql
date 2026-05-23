-- DB/schema/inventory/bulk_soft_delete_import_error_jobs.rpc.sql
-- Purpose: Staff/admin cleanup for old import error jobs without hard deleting history.

drop function if exists public.bulk_soft_delete_import_error_jobs(text, timestamptz, text);

create or replace function public.bulk_soft_delete_import_error_jobs(
  p_target_entity text default null::text,
  p_before timestamptz default now(),
  p_reason text default null::text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_org_id uuid;
  v_role text;
  v_deleted_count integer := 0;
  v_reason text;
begin
  v_org_id := public.current_user_org_id();
  v_role := public.current_user_role();

  if auth.role() <> 'service_role'::text and v_org_id is null then
    raise exception 'UNAUTHENTICATED'
      using errcode = '28000';
  end if;

  if auth.role() <> 'service_role'::text and coalesce(v_role, '') not in ('admin', 'staff') then
    raise exception 'FORBIDDEN_IMPORT_CLEANUP'
      using errcode = '42501';
  end if;

  if p_target_entity is not null
     and p_target_entity not in ('inventory', 'patients', 'trials', 'legacy_patient_devices') then
    raise exception 'INVALID_IMPORT_TARGET_ENTITY'
      using errcode = '22023';
  end if;

  v_reason := coalesce(nullif(btrim(p_reason), ''), 'Bulk import error cleanup');

  with candidates as (
    select j.id
    from public.import_jobs j
    where j.org_id = v_org_id
      and j.deleted_at is null
      and j.created_at <= coalesce(p_before, now())
      and (p_target_entity is null or j.target_entity = p_target_entity)
      and j.target_entity in ('inventory', 'patients', 'trials', 'legacy_patient_devices')
      and (
        j.status = 'failed'
        or coalesce(j.error_count, 0) > 0
        or exists (
          select 1
          from public.inventory_import_rows r
          where r.job_id = j.id
            and r.valid = false
            and r.resolved_at is null
        )
        or exists (
          select 1
          from public.patients_import_rows r
          where r.job_id = j.id
            and r.status = 'error'
        )
        or exists (
          select 1
          from public.patients_legacy_devices_import_rows r
          where r.job_id = j.id
            and r.status = 'error'
        )
      )
  ), updated as (
    update public.import_jobs j
    set deleted_at = now(),
        deleted_by = auth.uid(),
        delete_reason = v_reason
    where j.id in (select c.id from candidates c)
      and j.org_id = v_org_id
    returning 1
  )
  select count(*)::integer into v_deleted_count
  from updated;

  return coalesce(v_deleted_count, 0);
end;
$function$;

revoke all on function public.bulk_soft_delete_import_error_jobs(text, timestamptz, text)
  from public, anon;
grant execute on function public.bulk_soft_delete_import_error_jobs(text, timestamptz, text)
  to authenticated, service_role;
