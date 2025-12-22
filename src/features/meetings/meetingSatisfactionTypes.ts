// src/features/meetings/meetingSatisfactionTypes.ts
// Summary: Shared types, constants and helpers for meeting satisfaction surveys.
// - 1–5 satisfaction scale with labels
// - DB-backed types for:
//     * meeting_satisfaction_question_lists
//     * meeting_satisfaction_questions
//     * meeting_satisfaction_answers
// - Input payload type for saveMeetingSatisfaction (SaveMeetingSatisfactionInput)

export type SatisfactionScore = 1 | 2 | 3 | 4 | 5;

export const SATISFACTION_OPTIONS: {
  value: SatisfactionScore;
  label: string;
}[] = [
  { value: 1, label: 'Hiç memnun değilim' },
  { value: 2, label: 'Memnun değilim' },
  { value: 3, label: 'Normal' },
  { value: 4, label: 'Memnunum' },
  { value: 5, label: 'Çok memnunum' },
];

/**
 * Question list row (meeting_satisfaction_question_lists).
 * Şu an UI tarafında sadece id + name kullanıyoruz ama
 * diğer alanları da opsiyonel bırakarak schema ile uyumlu tutuyoruz.
 */
export interface MeetingSatisfactionQuestionList {
  id: string;
  name: string;
  is_active: boolean;
  org_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Gelecekte eklenecek kolonlara karşı esnek olması için:
  [key: string]: any;
}

/**
 * Question row (meeting_satisfaction_questions).
 * MeetingSatisfactionSurveySection bu alanları bekliyor:
 * - id
 * - list_id
 * - sort_order
 * - question_text
 * - is_active
 */
export interface MeetingSatisfactionQuestion {
  id: string;
  list_id: string;
  sort_order: number;
  question_text: string;
  is_active: boolean;
  org_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: any;
}

/**
 * Answer row (meeting_satisfaction_answers).
 * fetchAnswersForMeeting bu shape ile çalışıyor ve
 * MeetingSatisfactionSurveySection içinde question_id alanı kullanılıyor.
 */
export interface MeetingSatisfactionAnswer {
  id?: string;
  meeting_id: string;
  patient_id: string;
  list_id: string;
  question_id: string;
  score: SatisfactionScore | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: any;
}

/**
 * saveMeetingSatisfaction için input payload.
 * - meetingId / patientId / listId: JS tarafındaki alan isimleri (camelCase).
 * - answers: tek tek soru cevapları (questionId + 1–5 arası score).
 *
 * Not: meetings.satisfaction_10 güncellemesini API içinde answers üzerinden
 * hesaplayacağız; bu yüzden burada ayrıca overallScore5/10 alanına gerek yok.
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
