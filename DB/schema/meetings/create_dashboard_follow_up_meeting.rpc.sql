-- DB/schema/meetings/create_dashboard_follow_up_meeting.rpc.sql
-- Purpose: Atomically create a dashboard follow-up meeting and clear the source alert.

drop function if exists public.create_dashboard_follow_up_meeting(
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  integer
);

create or replace function public.create_dashboard_follow_up_meeting(
  p_source_meeting_id uuid,
  p_subject text,
  p_note text default null::text,
  p_at timestamptz default now(),
  p_next_at timestamptz default null::timestamptz,
  p_satisfaction_10 integer default null::integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_org_id uuid;
  v_role text;
  v_source public.meetings%rowtype;
  v_new_meeting_id uuid;
  v_subject text;
begin
  v_org_id := public.current_user_org_id();
  v_role := public.current_user_role();

  if auth.role() <> 'service_role'::text and v_org_id is null then
    raise exception 'UNAUTHENTICATED'
      using errcode = '28000';
  end if;

  if auth.role() <> 'service_role'::text and coalesce(v_role, '') not in ('admin', 'staff') then
    raise exception 'FORBIDDEN_MEETING_FOLLOW_UP'
      using errcode = '42501';
  end if;

  if p_satisfaction_10 is not null and (p_satisfaction_10 < 1 or p_satisfaction_10 > 10) then
    raise exception 'INVALID_SATISFACTION'
      using errcode = '22023';
  end if;

  select *
  into v_source
  from public.meetings m
  where m.id = p_source_meeting_id
    and m.org_id = v_org_id
    and m.deleted_at is null
  for update;

  if not found then
    raise exception 'SOURCE_MEETING_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if coalesce(v_source.meeting_type, '') = 'reference'
     and auth.role() <> 'service_role'::text
     and coalesce(v_role, '') <> 'admin' then
    raise exception 'FORBIDDEN_REFERENCE_MEETING'
      using errcode = '42501';
  end if;

  if v_source.next_at is null or v_source.follow_up_alert_armed_at is null then
    raise exception 'SOURCE_MEETING_HAS_NO_ACTIVE_FOLLOW_UP'
      using errcode = '22023';
  end if;

  if v_source.follow_up_alert_dismissed_next_at is not distinct from v_source.next_at then
    raise exception 'SOURCE_MEETING_FOLLOW_UP_ALREADY_CLOSED'
      using errcode = '22023';
  end if;

  v_subject := nullif(btrim(coalesce(p_subject, '')), '');
  if v_subject is null then
    v_subject := 'Gorusme kaydi';
  end if;

  insert into public.meetings (
    org_id,
    meeting_type,
    subject_id,
    subject_name,
    patient_id,
    trial_id,
    reference_id,
    subject,
    note,
    at,
    next_at,
    satisfaction_10,
    created_by,
    follow_up_alert_armed_at
  )
  values (
    v_source.org_id,
    v_source.meeting_type,
    v_source.subject_id,
    v_source.subject_name,
    case when v_source.meeting_type = 'patient' then v_source.subject_id else null end,
    case when v_source.meeting_type = 'trial' then v_source.subject_id else null end,
    case when v_source.meeting_type = 'reference' then v_source.subject_id else null end,
    v_subject,
    nullif(btrim(coalesce(p_note, '')), ''),
    coalesce(p_at, now()),
    p_next_at,
    p_satisfaction_10,
    auth.uid(),
    case when p_next_at is not null then now() else null end
  )
  returning id into v_new_meeting_id;

  update public.meetings
  set follow_up_alert_dismissed_at = now(),
      follow_up_alert_dismissed_by = auth.uid(),
      follow_up_alert_dismissed_next_at = v_source.next_at
  where id = v_source.id
    and org_id = v_source.org_id;

  return v_new_meeting_id;
end;
$function$;

revoke all on function public.create_dashboard_follow_up_meeting(
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  integer
) from public, anon;

grant execute on function public.create_dashboard_follow_up_meeting(
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  integer
) to authenticated, service_role;
