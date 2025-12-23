// src/features/references/types.ts
// Summary: Shared TypeScript types for reference entities used in UI and API.
// v2.2.0:
// - ADD: SoftDeleteMode for admin list filtering (active/deleted/all).
// - ADD: deleted_at to ReferenceRow for soft delete support.

export type ReferenceGroup = 'medikal' | 'doktor' | 'odyolog' | 'dernek' | '';

export type ReferenceCommissionScheme = 'percent' | 'fixed' | null;

export type SoftDeleteMode = 'active' | 'deleted' | 'all';

export type ReferenceRow = {
  id: string;
  full_name: string | null;
  group: ReferenceGroup | null;

  phone: string | null;
  commission_scheme: ReferenceCommissionScheme;
  /**
   * Stored as 0–1 in DB. Example: 0.10 = %10
   */
  commission_percent: number | null;
  /**
   * Default fixed commission amount in TL.
   */
  commission_fixed: number | null;
  is_active: boolean;

  /**
   * Follow-up cadence in days. Null = no automatic reminder.
   */
  contact_interval_days: number | null;

  last_meet_at: string | null;
  next_meet_at: string | null;
  note: string | null;
  created_at: string;

  /**
   * Soft delete marker. Null = active row.
   * Admin list may show deleted rows when filtering.
   */
  deleted_at: string | null;
};

export type NewReferenceForm = {
  fullName: string;
  group: ReferenceGroup;

  phone: string;
  commissionScheme: ReferenceCommissionScheme;
  /**
   * UI value as percent. Example: 10 = %10
   */
  commissionPercent: number;
  /**
   * UI value in TL.
   */
  commissionFixed: number;

  /**
   * UI value for contact_interval_days as string.
   * Empty string = no schedule.
   */
  contactIntervalDays: string;

  lastMeetAt: string;
  nextMeetAt: string;
  note: string;
  isActive: boolean;
};
