-- DB/schema/inventory/bulk_hard_delete_import_jobs.rpc.sql
-- Purpose: Staff/admin cleanup for import job history and staging rows.
-- Deletes import_jobs in the current org; staging rows are removed by FK cascade.

drop function if exists public.bulk_hard_delete_import_jobs(text, timestamptz, text);

create or replace function public.bulk_hard_delete_import_jobs(
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
begin
  v_org_id := public.current_user_org_id();
  v_role := public.current_user_role();

  if v_org_id is null then
    raise exception 'UNAUTHENTICATED'
      using errcode = '28000';
  end if;

  if coalesce(v_role, '') not in ('admin', 'staff') then
    raise exception 'FORBIDDEN_IMPORT_CLEANUP'
      using errcode = '42501';
  end if;

  if p_target_entity is not null
     and p_target_entity not in ('inventory', 'patients', 'trials', 'legacy_patient_devices') then
    raise exception 'INVALID_IMPORT_TARGET_ENTITY'
      using errcode = '22023';
  end if;

  with candidates as (
    select j.id
    from public.import_jobs j
    where j.org_id = v_org_id
      and j.deleted_at is null
      and j.created_at <= coalesce(p_before, now())
      and (p_target_entity is null or j.target_entity = p_target_entity)
      and j.target_entity in ('inventory', 'patients', 'trials', 'legacy_patient_devices')
  ), deleted as (
    delete from public.import_jobs j
    where j.id in (select c.id from candidates c)
      and j.org_id = v_org_id
    returning 1
  )
  select count(*)::integer into v_deleted_count
  from deleted;

  return coalesce(v_deleted_count, 0);
end;
$function$;

revoke all on function public.bulk_hard_delete_import_jobs(text, timestamptz, text)
  from public, anon;
grant execute on function public.bulk_hard_delete_import_jobs(text, timestamptz, text)
  to authenticated, service_role;
