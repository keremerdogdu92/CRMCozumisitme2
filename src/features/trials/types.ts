// src/features/trials/types.ts
// Shared TypeScript types for trial (deneme) entities used in UI and API.

export type TrialRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  first_meet_at: string | null;
  next_meet_at: string | null;
  created_at: string;
  reference_id: string | null;
};

export type NewTrialForm = {
  fullName: string;
  phone: string;
  firstMeetAt: string; // datetime-local string, can be empty
  nextMeetAt: string;  // datetime-local string, can be empty
};
