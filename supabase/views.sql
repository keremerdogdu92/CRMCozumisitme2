-- Reporting views for Hearing CRM

create or replace view v_accounts_receivable as
select
  pay.org_id,
  p.id as patient_id,
  coalesce(sum(i.amount - i.paid_amount), 0) as remaining
from payments pay
join installments i on i.payment_id = pay.id
join patients p on p.id = pay.patient_id
where (i.amount - i.paid_amount) > 0
  and pay.org_id = i.org_id
  and pay.org_id = p.org_id
group by pay.org_id, p.id;

create or replace view v_overdue_receivable as
select v.*
from v_accounts_receivable v
where exists (
  select 1
  from payments pay
  join installments i on i.payment_id = pay.id
  where pay.patient_id = v.patient_id
    and pay.org_id = v.org_id
    and (i.amount - i.paid_amount) > 0
    and i.due_date < current_date
);
