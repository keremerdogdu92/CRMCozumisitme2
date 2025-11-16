// src/features/references/types.ts
// Shared TypeScript types for reference entities used in UI and API.

export type ReferenceGroup = 'medikal' | 'doktor' | 'odyolog' | 'dernek' | '';

export type ReferenceRow = {
  id: string;
  full_name: string | null;
  group: ReferenceGroup | null;
  last_meet_at: string | null;
  next_meet_at: string | null;
  note: string | null;
  created_at: string;
};

export type NewReferenceForm = {
  fullName: string;
  group: ReferenceGroup;
  lastMeetAt: string;
  nextMeetAt: string;
  note: string;
};
