# Soft Delete Plan (CRM Database)

## Goal

Unify deletion semantics across CRM tables using **soft delete** instead of hard delete, so that:
- Business history is not lost (patients, trials/leads, sales, devices, meetings).
- Accidental deletes can be recovered.
- Reports remain consistent over time.
- Security guarantees (multi-org + role rules) remain deterministic and auditable.

This plan reflects the **current decisions** and the **actual implementation direction**:
- helper-based multi-org RLS (`current_user_org_id()` / `current_user_role()`)
- soft delete with `deleted_*` fields
- **no hard delete for authenticated users**
- deterministic policy naming with explicit DROP + CREATE
- **schema files as the only source-of-truth**

---

## Definitions

### Soft delete
A record is considered “deleted” when:
- `deleted_at IS NOT NULL`

The row remains in the table, can be restored, and is excluded from UI/reporting by default.

### RPC (what it means here)
In this project, **RPC** refers to PostgreSQL functions (Supabase RPC) that are called from the client, e.g.:
- `public.soft_delete_patients(p_id, p_reason)`
- `public.restore_patients(p_id)`

RPCs are used when we want:
- a single canonical delete/restore mechanism,
- a stable authorization boundary (`SECURITY DEFINER`),
- consistent stamping behavior,
- **idempotency** (repeated calls must not error or double-delete).

RPC usage is optional per table; some tables may use direct UPDATE calls.

---

## Global Decisions (Final)

### 1) Soft delete columns
For business-critical tables, soft delete uses:

- `deleted_at timestamptz NULL`
- `deleted_by uuid NULL` (FK → `auth.users(id)`, `ON DELETE SET NULL`)
- `delete_reason text NULL` (optional; never required)

`delete_reason` is never mandatory, but UI may ask for it.

---

### 2) No hard delete for authenticated users
Authenticated users (staff/admin):
- **must not** hard-delete business records.

Enforcement:
- no authenticated `DELETE` policy
- no authenticated `DELETE` grant

Hard delete remains available **only** to `service_role`
(for maintenance, anonymization, emergency repair).

---

### 3) Soft delete stamping (`deleted_by`)
`deleted_by` is automatically stamped via a shared trigger:

- `public.trg_soft_delete_set_deleted_by()`

Behavior:
- On UPDATE where `deleted_at` transitions from `NULL → NOT NULL`,
  `deleted_by = auth.uid()` is set if empty.
- Repeated soft delete attempts on an already-deleted row:
  - are a **no-op**
  - do not error
  - do not change timestamps again

---

### 4) Default visibility + UI filters
Default list behavior (staff + admin):
- **Active-only** (`deleted_at IS NULL`)

UI supports a visibility filter:
- `Active` / `Deleted` / `All`

Additionally:
- This filter can be **globally hidden** via Staff Settings
  (for users who never want to see deleted data).
- There is **no role-based restriction** on the filter itself,
  except where an entire domain is hidden (see Reference Meetings).

---

### 5) Cascade behavior (soft delete + restore)
Soft delete exists specifically to preserve relational history.

Rules:
- Child/business tables should follow the parent **when they represent the same business context**.
- Cascade is implemented via **deterministic SQL functions or triggers** (org-safe).

Restore:
- Restore should be possible where feasible.
- Conflicts must be detected and surfaced (never silently overwritten).

---

### 6) Reporting
- Reports and KPIs **exclude soft-deleted rows by default**.
- Deleted data is only included via explicit filters or admin tooling.

---

### 7) Role visibility: Reference meetings (strict rule)
Staff must not see **anything** related to reference meetings.

This means:
- No rows
- No joins
- No counts
- No UI hints

Enforcement:
- Staff UI must not query reference-only datasets.
- RLS validates meeting type and allows access only for:
  - admin
  - service_role

---

## Multi-Org Security Standard

- Never trust `org_id` from JWT claims.
- Always resolve context using helpers:
  - `public.current_user_org_id()`
  - `public.current_user_role()`

RLS rules:
- Legacy policies must be explicitly dropped.
- Canonical policies must be recreated with stable names.

---

## Target Tables

### Business-critical (soft delete required)
At minimum:

- `public.patients`
- `public.trials`
- `public.trial_devices`
- `public.meetings`
- `public.meeting_payments`
- `public.meeting_accessories`
- `public.patient_sale_breakdown`
- `public.patient_installment_plans`
- `public.inventory_items`
- `public.references`
- `public.reference_gifts`
- `public.device_repairs`
- `public.battery_prescription_deliveries`

---

### Views
- Views do **not** define RLS.
- Underlying tables enforce access.
- All views must use:
  - `WITH (security_invoker = on)`

---

### Staging / import tables
Staging tables (e.g. `*_import_rows`) are operational, not business history.

Rules:
- Hard delete may remain for `service_role`.
- Authenticated access is allowed only if required by UI/import flow.
- These tables are explicitly **out of scope** for soft delete guarantees.

---

## Trials = Lead Pipeline (Final Model)

Trials are **not deleted patients**.
They represent lead activity and sales opportunity tracking.

### Rules

#### Conversion
When a trial converts to a patient:
- Trial is **not deleted**
- `status = 'converted'`
- `converted_patient_id` is set

#### Lost trials
When a trial does not convert:
- `status = 'lost'`
- Store:
  - `lost_at timestamptz`
  - `lost_reason text` (optional)
  - `note` remains usable

#### Visibility
- Default list shows `status = 'active'`
- `converted` and `lost` visible via filters

Soft delete still exists for trials, but is reserved for:
- accidental creation
- true removal (recoverable)

---

## Unique Constraints + Conflict Handling

### Patients — `national_id`
Within the same org:
- `national_id` must be unique among **active** patients.
- Soft-deleted rows do **not** block new inserts.

Restore:
- Restore must fail gracefully if it violates active uniqueness.
- UI must guide the user (open existing patient, compare, resolve).

---

### Inventory — `serial_no`
Within the same org:
- `serial_no` must be unique among **active** inventory items.
- Soft-deleted rows do not block inserts.

UI behavior:
- Conflict with active row:
  - show friendly error
  - provide “open existing record” CTA
- Conflict with deleted row:
  - show warning
  - offer optional restore

---

## RLS Canonical Pattern

For each business-critical table:

1) **Service role bypass**
- `FOR ALL`
- `USING (auth.role() = 'service_role')`
- `WITH CHECK (auth.role() = 'service_role')`

2) **Org isolation**
- `org_id = public.current_user_org_id()`

3) **Soft delete**
- Authenticated DELETE: **not allowed**
- Soft delete via UPDATE or RPC
- Trigger stamps `deleted_by`

4) **Select filtering**
- Default filtering is handled at UI level
- RLS may further restrict sensitive domains

---

## Repository & DB Update Protocol (MANDATORY)

This project follows a **strict, non-negotiable rule**:

### 1) Schema files are the single source-of-truth
- `DB/schema/**` files always represent the **final desired state**.
- These files are kept fully updated.

### 2) Every change is delivered as TWO outputs
For any schema change:

**A) Apply SQL**
- Safe SQL to move the existing DB to the new state
- Uses `ALTER TABLE`, `CREATE INDEX IF NOT EXISTS`,
  `DROP/CREATE POLICY`, `CREATE OR REPLACE FUNCTION`, etc.
- Designed to run in Supabase SQL Editor without errors.

**B) Full updated schema file(s)**
- Complete, paste-ready SQL files
- These remain in the repo as the only truth

### 3) No migration history is kept
- We do **not** store incremental migration files.
- The repo stays correct by keeping schema files correct.

---

## Current Status

- Helper-based multi-org RLS is established.
- Soft delete pattern is active across many tables.
- No authenticated hard delete remains.
- Remaining work:
  - confirm DB truth vs repo per table
  - upgrade Trials pipeline (DB + UI)
  - standardize delete/restore UX
  - finalize active-only unique indexes
