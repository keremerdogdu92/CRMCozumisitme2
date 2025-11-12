-- Supabase schema for Hearing CRM

-- ORGANIZATION & PROFILE
create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  role text not null check (role in ('admin','staff')),
  created_at timestamptz default now()
);

-- PATIENTS
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  full_name text not null,
  national_id text,
  address text,
  phone text,
  kin_phone text,
  sgk_prescription_no text,
  sgk_flag boolean default false,
  sgk_docs_received boolean default false,
  sgk_processed boolean default false,
  constraint patients_sgk_flow check (
    (sgk_processed is not true or sgk_docs_received is true) and
    (sgk_docs_received is not true or sgk_flag is true)
  ),
  satisfaction_10 int check (satisfaction_10 between 1 and 10),
  created_at timestamptz default now(),
  last_visit_at timestamptz
);

-- DEVICES & PATIENT DEVICES
create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  brand text,
  model text,
  barcode text unique,
  serial text unique,
  status text check (status in ('stock','sold','repair')) default 'stock',
  hold_patient_id uuid references patients(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists patient_devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  device_id uuid not null references devices(id) on delete restrict,
  side text check (side in ('left','right')),
  price numeric(12,2),
  assigned_at timestamptz default now(),
  unassigned_at timestamptz,
  archive_code text not null
);

-- REFERENCES & LINKS
create table if not exists "references" (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  full_name text,
  "group" text check ("group" in ('medikal','doktor','odyolog','dernek')),
  last_meet_at date,
  next_meet_at date,
  note text
);

create table if not exists reference_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  reference_id uuid references "references"(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  scheme text check (scheme in ('none','fixed','percent')),
  fixed_amount numeric(12,2),
  percent_rate numeric(6,4),
  paid_amount numeric(12,2) default 0
);

-- TRIALS
create table if not exists trials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  full_name text,
  phone text,
  first_meet_at timestamptz,
  next_meet_at timestamptz,
  reference_id uuid references "references"(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists trial_devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  trial_id uuid not null references trials(id) on delete cascade,
  side text check (side in ('left','right')),
  brand text,
  model text,
  quote_price numeric(12,2)
);

-- MEETINGS
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  subject text,
  note text,
  at timestamptz,
  next_at timestamptz,
  satisfaction_10 int check (satisfaction_10 between 1 and 10),
  patient_id uuid references patients(id) on delete set null,
  trial_id uuid references trials(id) on delete set null,
  reference_id uuid references "references"(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- PAYMENTS & INSTALLMENTS
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null,
  method text check (method in ('Tim','Sivantos','Kredi_Kartı','Nakit','Senet')),
  total numeric(12,2),
  fee_amount numeric(12,2) default 0,
  note text,
  meeting_id uuid references meetings(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists installments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  payment_id uuid not null references payments(id) on delete cascade,
  due_date date,
  amount numeric(12,2),
  paid_amount numeric(12,2) default 0
);

-- ACCESSORIES
create table if not exists accessories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  type text,
  barcode text,
  serial text,
  cost numeric(12,2) default 0,
  price numeric(12,2) default 0,
  paid_amount numeric(12,2) default 0,
  device_id uuid references devices(id) on delete set null,
  patient_id uuid references patients(id) on delete set null,
  meeting_id uuid references meetings(id) on delete set null,
  created_at timestamptz default now()
);

-- AUDIOGRAMS
create table if not exists audiograms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  patient_id uuid references patients(id) on delete cascade,
  measured_at date,
  storage_key text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists audiogram_measures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  audiogram_id uuid not null references audiograms(id) on delete cascade,
  ear text check (ear in ('left','right')),
  metric text check (metric in ('HY','KY','UCL')),
  f125 numeric,
  f250 numeric,
  f500 numeric,
  f1k numeric,
  f2k numeric,
  f3k numeric,
  f4k numeric,
  f6k numeric,
  f8k numeric,
  unique (audiogram_id, ear, metric)
);

-- DEVICE REPAIRS
create table if not exists device_repairs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  device_id uuid references devices(id) on delete set null,
  patient_id uuid references patients(id) on delete set null,
  sent_at timestamptz,
  returned_at timestamptz,
  cost numeric(12,2) default 0,
  note text,
  meeting_id uuid references meetings(id) on delete set null
);

-- REFERENCE GIFTS
create table if not exists reference_gifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  reference_id uuid references "references"(id) on delete cascade,
  meeting_id uuid references meetings(id) on delete set null,
  title text,
  cash_value numeric(12,2) default 0,
  note text,
  created_at timestamptz default now()
);

-- DEVICE MODEL PRICE HISTORY
create table if not exists device_model_prices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  model text,
  effective_from date,
  purchase_cost numeric(12,2),
  unique (org_id, model, effective_from)
);

-- ARCHIVE COUNTER
create table if not exists archive_counters (
  org_id uuid not null references orgs(id) on delete cascade,
  yyyymm int not null,
  seq int not null,
  primary key (org_id, yyyymm)
);
