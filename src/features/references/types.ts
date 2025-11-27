// src/features/references/types.ts
// Shared TypeScript types for reference entities used in UI and API.

export type ReferenceGroup = 'medikal' | 'doktor' | 'odyolog' | 'dernek' | '';

export type ReferenceCommissionScheme = 'percent' | 'fixed' | null;

export type ReferenceRow = {
  id: string;
  full_name: string | null;
  group: ReferenceGroup | null;

  // New fields
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

  last_meet_at: string | null;
  next_meet_at: string | null;
  note: string | null;
  created_at: string;
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

  lastMeetAt: string;
  nextMeetAt: string;
  note: string;
  isActive: boolean;
};
