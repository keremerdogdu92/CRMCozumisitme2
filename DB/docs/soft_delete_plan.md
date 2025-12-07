db/docs/soft_delete_plan.md


# Soft Delete Plan (CRM Database)

## Goal

Unify deletion semantics across CRM tables using **soft delete** instead of hard delete, so that:
- Business history is not lost (patients, trials, sales, devices, meetings).
- Accidental deletes can be recovered.
- Reports remain consistent over time.

## Target Tables (phase 2)

Phase 2 soft delete refactor will cover at least:

- `public.patients` (patients.sql)
- `public.trials` (trials.sql)
- `public.trial_devices` (trial_devices.sql)
- `public.meetings` (meetings.sql)
- `public.meeting_payments` (meeting_payments.sql)
- `public.meeting_accessories` (meeting_accessories.sql)
- `public.patient_sale_breakdown` (patient_sale_breakdown.sql)
- `public.inventory_items` (inventory_items.sql) — already has `deleted_at`, needs RLS alignment
- `public.references` (references.sql)
- Any future tables that represent business-critical records.

> Note: Current RLS policies for these tables allow **hard delete** for authenticated users in their own org.
> This is acceptable for now, but MUST be revisited before production.

## Design Draft (to be applied later)

### 1. Schema

For each target table:

- Add:
  - `deleted_at timestamptz NULL`
  - optionally `deleted_by uuid NULL` referencing `profiles(id)` (phase 3).
- Keep existing primary keys and foreign keys unchanged.

### 2. Behaviour

- Normal users **never** execute SQL `DELETE` on these tables.
- Instead, application uses:
  - `UPDATE <table> SET deleted_at = now() WHERE id = ... AND org_id = ...;`
- Service role (backend) may still perform hard delete for maintenance / anonymization jobs.

### 3. RLS Guidelines

For each table:

- `SELECT` for normal users:
  - `USING (deleted_at IS NULL AND org_id = user_org_id())`
- `UPDATE` for normal users:
  - `USING (deleted_at IS NULL AND org_id = user_org_id())`
  - `WITH CHECK (deleted_at IS NULL AND org_id = user_org_id())`
- `DELETE` policy for normal users:
  - **Removed** (no DELETE policy).
- Service role:
  - Either keep a `FOR ALL` policy `USING (auth.role() = 'service_role')`
    to allow maintenance across all orgs, including hard delete.

`user_org_id()` is a conceptual helper; today we mostly use `auth.jwt()->>'org_id'`.
Later we may centralize this into a SQL function.

### 4. Migration Steps (for each table)

1. Add `deleted_at` (and `deleted_by` if needed).
2. Deploy new RLS policies that:
   - Filter out `deleted_at IS NOT NULL` rows for non-service users.
3. Update backend / frontend code:
   - Replace `DELETE` operations with `UPDATE ... SET deleted_at = now()`.
4. (Optional) Backfill for previously "logically deleted" records if needed.
5. Document behaviour in table-level comments and keep this README in sync.

### 5. Current Status

- Phase 1 (RLS cleanup, org isolation) is in progress.
- Phase 2 (soft delete implementation) is **not** started yet.
- All related SQL files contain a `[TODO-SOFT-DELETE]` comment pointing back to this document.
