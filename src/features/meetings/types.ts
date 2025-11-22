// src/features/meetings/types.ts
// Type definitions for Meetings feature, aligned with Supabase schema.

export interface MeetingRow {
  id: string;
  subject: string | null;
  note: string | null;
  at: string | null;        // ISO string from timestamptz
  next_at: string | null;   // ISO string from timestamptz
  satisfaction_10: number | null;
  created_at: string;
}

export interface NewMeetingForm {
  subject: string;
  note: string;
  at: string;        // yyyy-MM-dd (HTML date input)
  next_at: string;   // yyyy-MM-dd (HTML date input)
  satisfaction10: string; // kept as string in form, parsed on submit
}
