-- Functions and triggers for Hearing CRM

create or replace function fn_next_archive_seq(p_org uuid, p_month int)
returns int
language plpgsql
as $$
declare
  v_seq int;
begin
  insert into archive_counters(org_id, yyyymm, seq)
  values (p_org, p_month, 1)
  on conflict (org_id, yyyymm)
  do update set seq = archive_counters.seq + 1
  returning archive_counters.seq into v_seq;
  return v_seq;
end;
$$;

create or replace function fn_make_archive_code(p_ts timestamptz, p_seq int)
returns text
language plpgsql
as $$
begin
  return to_char(p_ts, 'MM') || '-' || to_char(p_ts, 'YY') || '-' || p_seq::text;
end;
$$;

create or replace function trg_patient_devices_set_archive()
returns trigger
language plpgsql
as $$
declare
  v_seq int;
  v_month int;
  v_assigned timestamptz;
begin
  if new.assigned_at is null then
    new.assigned_at := now();
  end if;

  v_assigned := new.assigned_at;
  v_month := (date_part('year', v_assigned)::int * 100) + date_part('month', v_assigned)::int;
  v_seq := fn_next_archive_seq(new.org_id, v_month);
  new.archive_code := fn_make_archive_code(v_assigned, v_seq);

  update devices
     set status = 'sold',
         hold_patient_id = new.patient_id
   where id = new.device_id;

  return new;
end;
$$;

create or replace trigger trg_patient_devices_archive
before insert on patient_devices
for each row
execute function trg_patient_devices_set_archive();
