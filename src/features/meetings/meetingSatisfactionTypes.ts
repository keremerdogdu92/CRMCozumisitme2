// src/features/meetings/meetingSatisfactionTypes.ts
// Summary: TypeScript types for meeting satisfaction survey lists, questions and answers.

export type SatisfactionScore = 1 | 2 | 3 | 4 | 5;

export interface MeetingSatisfactionQuestionList {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface MeetingSatisfactionQuestion {
  id: string;
  org_id: string;
  list_id: string;
  question_text: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface MeetingSatisfactionAnswer {
  id: string;
  org_id: string;
  meeting_id: string;
  patient_id: string;
  list_id: string;
  question_id: string;
  score: SatisfactionScore;
  created_at: string;
}

/**
 * UI model for a single question + current answer, used in forms.
 */
export interface MeetingSatisfactionQuestionWithAnswer {
  question: MeetingSatisfactionQuestion;
  score: SatisfactionScore | null;
}

/**
 * UI-level payload when saving answers for a meeting in bulk.
 */
export interface SaveMeetingSatisfactionInput {
  meetingId: string;
  patientId: string;
  listId: string;
  answers: {
    questionId: string;
    score: SatisfactionScore;
  }[];
}
