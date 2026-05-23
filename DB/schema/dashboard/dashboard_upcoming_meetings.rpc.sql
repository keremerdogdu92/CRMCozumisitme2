-- db/schema/dashboard/dashboard_upcoming_meetings.rpc.sql
-- Purpose: Org-scoped upcoming meetings for dashboard.

drop function if exists public.dashboard_upcoming_meetings(int, uuid);

create or replace function public.dashboard_upcoming_meetings(
  _limit int default 10,
  _org_id uuid default null
) returns table (
  id uuid,
  meeting_type text,
  subject text,
  subject_name text,
  at timestamptz,
  next_at timestamptz,
  follow_up_at timestamptz,
  alert_severity text
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
), candidates as (
  select
    m.id,
    m.meeting_type,
    m.subject,
    m.subject_name,
    m.at,
    m.next_at,
    coalesce(m.next_at, m.at) as follow_up_at
  from public.meetings m
  join org_ctx o on o.org_id is not null and o.org_id = m.org_id
  where m.deleted_at is null
    and coalesce(m.next_at, m.at) is not null
    and coalesce(m.next_at, m.at) <= now() + interval '3 days'
    and (o.is_admin or coalesce(m.meeting_type, '') <> 'reference')
)
select
  c.id,
  c.meeting_type,
  c.subject,
  c.subject_name,
  c.at,
  c.next_at,
  c.follow_up_at,
  case
    when c.follow_up_at <= now() then 'error'
    else 'warning'
  end as alert_severity
from candidates c
order by
  case when c.follow_up_at <= now() then 0 else 1 end,
  case when c.follow_up_at <= now() then c.follow_up_at end desc nulls last,
  case when c.follow_up_at > now() then c.follow_up_at end asc nulls last
limit greatest(1, coalesce(_limit, 10));
$$;

revoke all on function public.dashboard_upcoming_meetings(int, uuid) from public, anon;
grant execute on function public.dashboard_upcoming_meetings(int, uuid) to authenticated, service_role;
