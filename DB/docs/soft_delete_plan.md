# DB/docs/soft_delete_plan.md

# Soft Delete Plan (CRM Database)

## Goal

Unify deletion semantics across CRM tables using **soft delete** instead of hard delete, so that:
- Business history is not lost (patients, trials/leads, sales, devices, meetings).
- Accidental deletes can be recovered.
- Reports remain consistent over time.
- Security guarantees (multi-org + role rules) remain deterministic and auditable.

This plan reflects the **current decisions** and the **implemented direction**:
- helper-based multi-org RLS (`current_user_org_id()` / `current_user_role()`)
- soft delete with `deleted_*` fields
- **no hard delete for authenticated**
- deterministic policy naming + explicit DROP/CREATE.

---

## Definitions

### Soft delete
A record is considered “deleted” when:
- `deleted_at IS NOT NULL`

The row remains in the table, can be restored, and can be excluded from UI/reporting by default.

### RPC (what it means here)
In this project, **RPC** refers to PostgreSQL functions (Supabase “RPC”) called from the client, e.g.:
- `public.soft_delete_patients(p_id, p_reason)`
- `public.restore_patients(p_id)`

We use RPCs when we want:
- a single canonical delete/restore mechanism,
- stable authorization boundary (SECURITY DEFINER),
- consistent stamping behavior,
- idempotent behavior (repeated calls should not crash).

---

## Global Decisions (Final)

### 1) Soft delete columns
For business-critical tables, soft delete uses:

- `deleted_at timestamptz NULL`
- `deleted_by uuid NULL` (FK to `auth.users(id)`, `ON DELETE SET NULL`)
- `delete_reason text NULL` (optional; never required)

`delete_reason` is never mandatory, but UI may ask for it.

### 2) No hard delete for authenticated users
Authenticated users (staff/admin) must **not** hard-delete business records.
- Hard delete remains available to `service_role` only (maintenance/anonymization/data repair).

This is enforced by:
- **no authenticated DELETE policy**
- **no authenticated DELETE grant**

### 3) Soft delete stamping (deleted_by)
`deleted_by` is automatically stamped on soft delete via a shared trigger function:

- `public.trg_soft_delete_set_deleted_by()`

Behavior:
- On UPDATE where `deleted_at` transitions from NULL → NOT NULL, set `deleted_by = auth.uid()` if not already set.
- If the row is already deleted, a second soft delete attempt should be a **no-op** (no changes, no errors).

### 4) Default visibility + UI filters
Default list behavior for both staff and admin:
- **Active-only** (`deleted_at IS NULL`) is default everywhere.

UI supports a filter:
- `Active` / `Deleted` / `All`

This filter can be disabled globally via **Staff Settings** so users who never work with deleted data can hide it.

There is **no role-based restriction** for the visibility filter (staff and admin may use it), except where a domain is fully hidden for staff (see Reference Meetings rule).

### 5) Cascade behavior (soft delete + restore)
Soft delete exists specifically to avoid losing relational history. Therefore:
- Child/business tables should be soft-deleted/restored together with the parent where appropriate.
- Cascade is implemented via deterministic SQL functions/triggers (org-safe).

Principle:
- If the child row is part of the same business entity context, it should follow the parent.
- Restore should be possible, subject to conflict checks.

### 6) Reporting
Reports and KPIs should **not include soft-deleted rows by default**.
Deleted data remains available only via filters/admin tooling when needed.

### 7) Role visibility special rule: reference meetings
Staff must not see **anything** that belongs to reference meetings:
- Staff should not infer reference activity via list rows, counts, joins, or UI components.
- Staff UI must not query reference-only datasets at all.
- Enforce in RLS for meetings-related tables by validating meeting type and allowing only admin/service_role for reference rows.

---

## Multi-Org Security Standard (Current Baseline)

- Never trust org_id from JWT claims in RLS.
- Resolve organisation context using helpers:
  - `public.current_user_org_id()`
  - `public.current_user_role()`

RLS policies must be deterministic:
- Drop legacy policies explicitly.
- Recreate canonical policies with stable names.

---

## Target Tables and Status

### Business-critical tables (soft delete required)
Phase 2 covers (at minimum):

- `public.patients`
- `public.trials` (lead pipeline; see Trials section)
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

### Views
Views do not have RLS policies; underlying tables enforce access.
Views must use:
- `WITH (security_invoker = on)`

### Staging/import tables (special handling)
Staging tables (e.g. `*_import_rows`) are operational, not business history.
- Hard delete can remain allowed for service_role.
- Authenticated access is allowed only if the UI needs it for the import flow.
- This is not urgent, but must remain consistent with the import mechanism.

---

## Trials = Lead Pipeline (Final Direction)

Trials are not “patients that get deleted when converted”.
Trials represent lead/try activity and must support follow-up analysis.

### Required rules
- When a trial converts to a patient:
  - Trial is **not deleted**
  - Trial becomes `status = 'converted'`
  - Trial links to patient via `converted_patient_id`
- When a trial does not convert:
  - Trial becomes `status = 'lost'`
  - Store:
    - `lost_at timestamptz`
    - `lost_reason text` (optional but recommended)
    - `note` remains usable
- Trial list default filter:
  - show `status = 'active'` only (reduces clutter)
  - converted/lost visible via filters/secondary views

Soft delete still exists for trials but is reserved for:
- accidental creation
- true removal (recoverable)

---

## Unique Constraints + Conflict Handling (Final Direction)

Soft delete must not block operations unnecessarily.

### Patients: `national_id` uniqueness
Within the same org:
- `national_id` must be unique among **active** (non-deleted) patients.
- Soft-deleted patients do not block creating a new patient with the same `national_id`.

Restore rules:
- Restoring a patient must fail gracefully if it would violate active uniqueness.
- UI should offer conflict guidance (open existing patient / compare / manual resolution).

### Inventory: `serial_no` uniqueness
Within the same org:
- `serial_no` must be unique among **active** (non-deleted) inventory items.
- Soft-deleted rows do not block new inserts.

UI behavior on conflict:
- Conflict with active unique row:
  - show friendly error
  - provide CTA to open the existing record (patient list filtered or inventory detail)
- Conflict against soft-deleted row:
  - show warning (“deleted record exists”)
  - offer optional restore (when entity supports restore)

---

## RLS Guidelines (Canonical Pattern)

For each business-critical table:

1) Service role bypass (recommended)
- `FOR ALL TO public`
- `USING (auth.role() = 'service_role')`
- `WITH CHECK (auth.role() = 'service_role')`

2) Org isolation
All authenticated access must be org-scoped:
- `org_id = public.current_user_org_id()`

3) Soft delete access
- Authenticated DELETE policy: **removed**
- Soft delete is performed via UPDATE (often via RPC):
  - sets `deleted_at = now()`
  - optional `delete_reason`
  - trigger stamps `deleted_by`

4) Select filtering
- Default UI filtering is application-level (Active-only by default),
  but RLS may further restrict for sensitive datasets (e.g. reference meetings).

---

## Implementation Checklist (Next Steps)

### Phase A — Confirm DB truth + patch schema files (repo is source-of-truth)
For each target table:
1. Verify actual DB schema (columns, indexes, constraints).
2. Align repo schema SQL with DB truth.
3. Ensure RLS is helper-based + deterministic.
4. Ensure no authenticated DELETE policy exists.
5. Ensure deleted_by stamping trigger exists where deleted_* columns exist.

### Phase B — Trials pipeline upgrade (DB + UI)
DB:
1. Add trials pipeline fields:
   - `status` (active/converted/lost)
   - `lost_at`
   - `lost_reason`
   - `converted_patient_id`
2. Keep existing soft delete columns and no hard delete.
3. Update `trials_convert_to_patient.rpc.sql` to:
   - create/select patient
   - mark trial `status='converted'` and set `converted_patient_id`
   - do NOT soft delete trial

UI:
1. Default list: status = active
2. Add filters for status (active/converted/lost) + soft delete mode (active/deleted/all)
3. Add lost workflow (mark lost + reason)
4. Add converted workflow visibility (view the linked patient)

### Phase C — UI standardization
1. Standard “Delete / Restore” behavior and dialogs.
2. Global staff setting to hide Deleted/All filters.
3. Ensure staff cannot query reference meetings data.

### Phase D — Conflict UX
1. Patient creation conflict (national_id): error + “Open existing patient list filtered”.
2. Soft-deleted conflict: warning + optional restore.
3. Restore conflict: block restore + guided resolution.

---

## Applying changes: Repo SQL vs Supabase SQL Editor (Important)

Repo `DB/schema/**` files contain **CREATE TABLE** and canonical policies.  
In Supabase SQL Editor, running a file that contains `CREATE TABLE public.<name>` will fail if the table already exists (example: `patients already exists`).

**Rule of thumb**
- For an existing production DB: apply changes using **migration-style scripts** (`ALTER TABLE`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP/CREATE POLICY`, etc.).
- Keep the repo file updated as the final source-of-truth, but do not expect to re-run full `CREATE TABLE` files in SQL Editor on an already-created DB.

Recommended repo structure (already partially present):
- `DB/schema/_apply_history/<timestamp>_<topic>.sql`
  - contains only “apply” statements (ALTER/CREATE INDEX/FUNCTION/POLICY)
- `DB/schema/**/<table>.sql`
  - remains full canonical schema definition for a clean environment.

---

## Current Status

- Helper-based multi-org RLS is established across core tables.
- Soft delete pattern is implemented across many business tables, including:
  - deleted_* columns
  - deleted_by stamping trigger
  - no authenticated DELETE policies
- Remaining work:
  - confirm DB-truth alignment per-table
  - implement Trials lead pipeline fields + UI
  - standardize UI delete/restore + conflict flows
  - add/verify active-only uniqueness indexes (patients national_id, inventory serial_no)
