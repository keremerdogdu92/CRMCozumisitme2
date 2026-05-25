// src/features/meetings/types.ts
// Summary: Type definitions for Meetings feature, aligned with Supabase schema.
// Integrations:
// - public.meetings: includes deleted_at for soft delete UI filtering.
// - Soft delete operations are executed via RPC (soft_delete_meetings / restore_meetings).

import type { MeetingSatisfactionDraft } from './meetingSatisfactionTypes';

export type MeetingType = 'patient' | 'trial' | 'reference';

export type MeetingAccessoryType =
  | 'Dom'
  | 'Kulak Kalıbı'
  | 'Receiver'
  | 'Filtre'
  | 'Pil'
  | 'Diğer';

export type MeetingAccessoryDraft = {
  id?: string;
  type: MeetingAccessoryType;
  customName: string;
  costPrice: string;
  salePrice: string;
};

export type MeetingAccessoryRow = {
  id: string;
  meeting_id: string;
  patient_id: string;
  org_id: string;
  name: string;
  cost_price: number;
  sale_price: number;
  created_at: string;
};

export interface MeetingRow {
  id: string;

  // Supabase columns
  meeting_type: MeetingType;
  subject_id: string | null;
  subject_name: string | null;

  subject: string | null; // Title of the meeting
  note: string | null;
  at: string | null; // ISO string from timestamptz
  next_at: string | null; // ISO string from timestamptz
  satisfaction_10: number | null;
  created_at: string;

  // Soft delete
  deleted_at: string | null;
}

/**
 * NewMeetingForm:
 * - UI form state (camelCase)
 * - Will be normalized before insert
 */
export interface NewMeetingForm {
  meetingType: MeetingType; // maps to meeting_type
  subjectId: string | null; // maps to subject_id
  subjectName: string; // maps to subject_name

  subject: string; // title
  note: string;
  at: string; // yyyy-MM-dd (HTML date input)
  next_at: string; // yyyy-MM-dd (HTML date input)

  /**
   * Payment section (currently only used when meetingType === 'patient'):
   * - hasPayment: whether a senet payment was taken in this meeting
   * - paymentAmount: amount entered by the user (string; will be parsed)
   * - paymentNote: optional note such as "3. taksit"
   */
  hasPayment: boolean;
  paymentAmount: string;
  paymentNote: string;

  /**
   * Accessories sold in this meeting (only for patient type).
   */
  accessories?: MeetingAccessoryDraft[];

  /**
   * Optional patient satisfaction prompts and answers shown in the same form.
   */
  satisfaction?: MeetingSatisfactionDraft | null;
}
