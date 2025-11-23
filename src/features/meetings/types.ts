// src/features/meetings/types.ts
// Type definitions for Meetings feature, aligned with Supabase `public.meetings` table.

export type MeetingType = 'patient' | 'trial' | 'reference';

export interface MeetingRow {
  id: string;
  subject: string | null;
  note: string | null;
  at: string | null;        // ISO string from timestamptz
  next_at: string | null;   // ISO string from timestamptz
  satisfaction_10: number | null;
  created_at: string;

  // New columns on `public.meetings`.
  // Marked optional for now so existing queries that don't select them
  // still type-check; we'll start using them as we refactor the feature.
  org_id?: string;
  created_by?: string | null;
  meeting_type?: MeetingType;
  subject_id?: string | null;
  subject_name?: string | null;
}

export interface NewMeetingForm {
  subject: string;
  note: string;
  at: string;        // yyyy-MM-dd (HTML date input)
  next_at: string;   // yyyy-MM-dd (HTML date input)
  satisfaction10: string; // kept as string in form, parsed on submit
}
