// src/features/meetings/types.ts
// Type definitions for Meetings feature, aligned with Supabase schema.

export type MeetingType = 'patient' | 'trial' | 'reference';

export interface MeetingRow {
  id: string;
  // Supabase columns
  meeting_type: MeetingType;
  subject_id: string | null;
  subject_name: string | null;

  subject: string | null;       // Title of the meeting
  note: string | null;
  at: string | null;            // ISO string from timestamptz
  next_at: string | null;       // ISO string from timestamptz
  satisfaction_10: number | null;
  created_at: string;
}

/**
 * NewMeetingForm:
 * - UI form state (camelCase)
 * - Will be normalized before insert
 */
export interface NewMeetingForm {
  meetingType: MeetingType;     // maps to meeting_type
  subjectId: string | null;     // maps to subject_id (v2.1: will be filled from picker)
  subjectName: string;          // maps to subject_name

  subject: string;              // title
  note: string;
  at: string;                   // yyyy-MM-dd (HTML date input)
  next_at: string;              // yyyy-MM-dd (HTML date input)
  satisfaction10: string;       // kept as string in form, parsed on submit
}
