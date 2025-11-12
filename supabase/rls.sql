-- Row Level Security policies for Hearing CRM

-- Enable RLS on all tables
alter table orgs enable row level security;
alter table profiles enable row level security;
alter table patients enable row level security;
alter table devices enable row level security;
alter table patient_devices enable row level security;
alter table "references" enable row level security;
alter table reference_links enable row level security;
alter table trials enable row level security;
alter table trial_devices enable row level security;
alter table meetings enable row level security;
alter table payments enable row level security;
alter table installments enable row level security;
alter table accessories enable row level security;
alter table audiograms enable row level security;
alter table audiogram_measures enable row level security;
alter table device_repairs enable row level security;
alter table reference_gifts enable row level security;
alter table device_model_prices enable row level security;
alter table archive_counters enable row level security;

-- ORGS
create policy orgs_select on orgs
for select using (
  auth.role() = 'service_role' or id::text = auth.jwt()->>'org_id'
);

create policy orgs_write on orgs
for all using (
  auth.role() = 'service_role' or id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or id::text = auth.jwt()->>'org_id'
);

-- PROFILES
create policy profiles_select on profiles
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy profiles_write on profiles
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

-- PATIENTS
create policy patients_select on patients
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy patients_write on patients
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

-- DEVICES
create policy devices_select on devices
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy devices_write on devices
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

-- PATIENT DEVICES
create policy patient_devices_select on patient_devices
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy patient_devices_write on patient_devices
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

-- REFERENCES
create policy references_select on "references"
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy references_write on "references"
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy reference_links_select on reference_links
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy reference_links_write on reference_links
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

-- TRIALS
create policy trials_select on trials
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy trials_write on trials
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy trial_devices_select on trial_devices
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy trial_devices_write on trial_devices
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

-- MEETINGS
create policy meetings_select on meetings
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy meetings_write on meetings
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

-- PAYMENTS
create policy payments_select on payments
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy payments_write on payments
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy installments_select on installments
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy installments_write on installments
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

-- ACCESSORIES
create policy accessories_select on accessories
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy accessories_write on accessories
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

-- AUDIOGRAMS
create policy audiograms_select on audiograms
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy audiograms_write on audiograms
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy audiogram_measures_select on audiogram_measures
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy audiogram_measures_write on audiogram_measures
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

-- DEVICE REPAIRS
create policy device_repairs_select on device_repairs
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy device_repairs_write on device_repairs
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

-- REFERENCE GIFTS
create policy reference_gifts_select on reference_gifts
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy reference_gifts_write on reference_gifts
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

-- DEVICE MODEL PRICES
create policy device_model_prices_select on device_model_prices
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy device_model_prices_write on device_model_prices
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

-- ARCHIVE COUNTERS
create policy archive_counters_select on archive_counters
for select using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);

create policy archive_counters_write on archive_counters
for all using (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
) with check (
  auth.role() = 'service_role' or org_id::text = auth.jwt()->>'org_id'
);
