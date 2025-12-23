// src/utils/softDelete/softDeleteTypes.ts
// Summary: Shared soft-delete filter types and helpers (UI-level admin controls).
// - active: only not-deleted rows (default)
// - deleted: only deleted rows
// - all: all rows (deleted + not deleted)

export type SoftDeleteMode = 'active' | 'deleted' | 'all';

export const SOFT_DELETE_MODE_OPTIONS: {
  value: SoftDeleteMode;
  label: string;
}[] = [
  { value: 'active', label: 'Aktif (silinmeyenler)' },
  { value: 'deleted', label: 'Sadece silinenler' },
  { value: 'all', label: 'Hepsi (aktif + silinen)' },
];

/**
 * Whether the query must include deleted rows from DB.
 * - active -> false (can use default filtered view/table)
 * - deleted/all -> true (must query the *_all view/table)
 */
export function needsIncludeDeleted(mode: SoftDeleteMode): boolean {
  return mode === 'deleted' || mode === 'all';
}

/**
 * Whether client-side filtering should keep only deleted rows.
 * This is used after fetching from an *_all source.
 */
export function isDeletedOnly(mode: SoftDeleteMode): boolean {
  return mode === 'deleted';
}
