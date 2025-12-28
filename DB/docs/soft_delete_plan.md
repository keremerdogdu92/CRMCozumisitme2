# Soft Delete Plan (CRM Database)

## Goal

Unify deletion semantics across CRM tables using **soft delete** instead of hard delete, so that:
- Business history is not lost (patients, trials/leads, sales, devices, meetings).
- Accidental deletes can be recovered.
- Reports remain consistent over time.
- Security guarantees (multi-org + role rules) remain deterministic and auditable.

This plan reflects the **current decisions** and the **implemented direction** (helper-based multi-org + soft delete + no authenticated hard delete).

---

## Global Decisions (Final)

### 1) Soft delete columns
For business-critical tables, soft delete is implemented with:

- `deleted_at timestamptz NULL`
- `deleted_by uuid NULL` (FK to `auth.users(id)`, `ON DELETE SET NULL`)
- `delete_reason text NULL` (optional; never required)

**delete_reason is never mandatory**, but can be collected when helpful.

### 2) No hard delete for authenticated users
Authenticated users (staff/admin) must **not** hard-delete business records.
- Hard delete remains available to `service_role` only (maintenance/anonymization/data repair).

### 3) Soft delete stamping (deleted_by)
`deleted_by` is automatically stamped on soft delete via a shared trigger function:

- `public.trg_soft_delete_set_deleted_by()`

Behavior:
- On UPDATE where `deleted_at` transitions from NULL → NOT NULL, set `deleted_by = auth.uid()` if not already set.
- Repeated soft delete attempts (row already deleted) should be a **no-op** (no changes, no errors).

### 4) Default visibility + UI filters
Default list behavior for both staff and admin:
- **Active-only** (`deleted_at IS NULL`) is the default everywhere.

UI supports a filter:
- `Active` / `Deleted` / `All`
- This filter can be disabled globally via **Staff Settings**, so users who never work with deleted data can hide the feature and reduce confusion.

There is **no role-based restriction** for the visibility filter: both staff and admin may use it.
(Separate role restrictions still apply for sensitive domains like reference meetings.)

### 5) Cascade behavior (soft delete + restore)
Soft delete exists specifically to avoid losing relational history. Therefore:
- Child/business tables should be soft-deleted/restored together with the parent where appropriate.
- Implement cascade via triggers and helper SQL functions (deterministic, org-safe).

Examples:
- If a parent is soft-deleted, dependent rows that represent the same business entity context should also be soft-deleted.
- When restoring, related rows should be restorable as well (subject to conflict checks).

### 6) Reporting
Reports and KPIs should **not include soft-deleted rows by default**.
Deleted data remains available only via filters/admin tooling when needed.

### 7) Role visibility special rule: reference meetings
Staff must not see **anything** that belongs to reference meetings:
- Staff should not be able to infer reference activity via list rows, counts, joins, or UI components.
- Staff UI should not query reference-only datasets at all.
- This is enforced in RLS policies by joining/validating against `meetings.meeting_type = 'reference'` and allowing only admin/service_role.

---

## Multi-Org Security Standard (Current Baseline)

- Never trust org_id from JWT claims in RLS.
- Resolve organisation context using helper(s), e.g.:
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
- `public.trials` (treated as a lead pipeline; see Trials section below)
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
- Authenticated access may be restricted depending on the import flow.
- This is not urgent but must remain consistent with the import mechanism.

---

## Trials = Lead Pipeline (Final Direction)

Trials are not "patients that get deleted when converted".
Trials represent lead/try activity and must support sales follow-up analysis.

### Required behavioral rules
- When a trial converts to a patient:
  - Trial is **not deleted**.
  - Trial becomes `status = 'converted'`.
  - Trial should link to the created/selected patient via `converted_patient_id` (or equivalent).
- When a trial does not convert:
  - Trial becomes `status = 'lost'`.
  - Store:
    - `lost_at timestamptz`
    - `lost_reason text` (optional but recommended)
    - existing `note` can be used as well
- Trial list default filter:
  - show `status = 'active'` only (reduces clutter)
  - converted/lost visible via filters/secondary views

Soft delete on trials still exists, but reserved for:
- accidental creation
- true removal (recoverable)

---

## Unique Constraints + Conflict Handling (Final Direction)

Soft delete must not block operations unnecessarily.

### Patients: `national_id` uniqueness
- Within the same org:
  - `national_id` must be **unique among active (non-deleted) patients**.
  - Soft-deleted patients do not block creating a new patient with the same `national_id`.

Restore rules:
- Restoring a patient must fail gracefully if it would violate active uniqueness.
- UI should offer conflict guidance (open existing patient / compare / manual resolution).

### Inventory: `serial_no` uniqueness
- Within the same org:
  - `serial_no` must be **unique among active (non-deleted) inventory items**.
  - Soft-deleted rows do not block new inserts.

UI behavior on conflict:
- Creating a new record that conflicts with an active unique row should:
  - fail with a friendly error
  - provide a CTA to open the existing record (patient list filtered or inventory detail view)
- Conflicts against soft-deleted rows should show:
  - warning that a deleted record exists
  - optional "Restore" action (if it makes sense for that entity)

---

## RLS Guidelines (Canonical Pattern)

For each business-critical table:

1) Service role bypass (optional but recommended)
- `FOR ALL TO public`
- `USING (auth.role() = 'service_role')`
- `WITH CHECK (auth.role() = 'service_role')`

2) Org isolation
All authenticated access must be org-scoped:
- `org_id = public.current_user_org_id()`

3) Soft delete access
- Hard DELETE policy for authenticated users: **removed**
- Soft delete is performed via UPDATE:
  - update sets `deleted_at = now()`, optional `delete_reason`
  - trigger stamps `deleted_by`

4) Select filtering
- Default UI filtering is application-level (active-only by default),
  but RLS may further restrict for sensitive datasets (e.g. reference meetings).

---

## Implementation Checklist (Next Steps)

### Phase A — Confirm DB truth + patch schema files (repo source-of-truth)
For each target table:
1. Verify actual DB schema (columns, indexes, constraints).
2. Align repo schema SQL with DB truth.
3. Ensure RLS is helper-based + deterministic.
4. Ensure no authenticated DELETE policy exists.
5. Ensure deleted_by stamping trigger exists where soft delete columns exist.

### Phase B — Trials pipeline upgrade (DB + UI)
1. Add trials pipeline fields (status, lost_at, lost_reason, converted_patient_id).
2. Update UI list defaults and filters.
3. Add conversion flow (trial → patient) without deleting trial.

### Phase C — UI standardization
1. Standard "Delete / Restore" behavior and dialogs.
2. Global staff setting to hide Deleted/All filters.
3. Ensure staff cannot query reference meetings data.

### Phase D — Conflict UX
1. Patient creation conflict (national_id): show error + "Open existing patient list filtered".
2. Soft-deleted conflict: warning + optional restore.
3. Restore conflict: block restore + guided resolution.

---

## Current Status

- Helper-based multi-org RLS is established across core tables.
- Soft delete pattern is now implemented across many business tables, including:
  - deleted_* columns, trigger stamping, and no authenticated DELETE policies.
- Remaining work is:
  - confirm DB-truth alignment per-table,
  - implement Trials lead pipeline fields + UI,
  - standardize UI delete/restore + conflict flows,
  - add/verify active-only uniqueness indexes (patients national_id, inventory serial_no).
