// src/features/meetings/api.satisfaction.ts
// Summary: Supabase API helpers for meeting satisfaction surveys.
// - Fetch active lists & questions for use in meeting forms.
// - Save per-meeting answers into meeting_satisfaction_answers.
// - Admin utilities for managing lists and questions from Settings.

import { supabaseClient } from '../../utils/supabaseClient';
import type {
  MeetingSatisfactionQuestionList,
  MeetingSatisfactionQuestion,
  MeetingSatisfactionAnswer,
  SaveMeetingSatisfactionInput,
  SatisfactionScore,
} from './meetingSatisfactionTypes';

/**
 * Fetch active survey question lists for the current org.
 * (Org is inferred from RLS; we don't filter by org_id on the client.)
 */
export async function fetchActiveSatisfactionLists(): Promise<MeetingSatisfactionQuestionList[]> {
  const { data, error } = await supabaseClient
    .from('meeting_satisfaction_question_lists')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('fetchActiveSatisfactionLists error', error);
    throw error;
  }
  return (data ?? []) as MeetingSatisfactionQuestionList[];
}

/**
 * Admin: fetch all lists (active + inactive) for management UI.
 */
export async function fetchAllSatisfactionLists(): Promise<MeetingSatisfactionQuestionList[]> {
  const { data, error } = await supabaseClient
    .from('meeting_satisfaction_question_lists')
    .select('*')
    .order('created_at', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('fetchAllSatisfactionLists error', error);
    throw error;
  }
  return (data ?? []) as MeetingSatisfactionQuestionList[];
}

/**
 * Fetch active questions for a given list, ordered by sort_order.
 * Used by meeting forms (short 5-question survey).
 */
export async function fetchQuestionsForList(
  listId: string,
): Promise<MeetingSatisfactionQuestion[]> {
  const { data, error } = await supabaseClient
    .from('meeting_satisfaction_questions')
    .select('*')
    .eq('list_id', listId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('fetchQuestionsForList error', error);
    throw error;
  }
  return (data ?? []) as MeetingSatisfactionQuestion[];
}

/**
 * Admin: fetch all questions for a list (active + inactive).
 * Used by Settings → Memnuniyet Soruları ekranı.
 */
export async function fetchAllQuestionsForList(
  listId: string,
): Promise<MeetingSatisfactionQuestion[]> {
  const { data, error } = await supabaseClient
    .from('meeting_satisfaction_questions')
    .select('*')
    .eq('list_id', listId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('fetchAllQuestionsForList error', error);
    throw error;
  }
  return (data ?? []) as MeetingSatisfactionQuestion[];
}

/**
 * Fetch previously saved answers for a given meeting (if you edit a meeting).
 */
export async function fetchAnswersForMeeting(
  meetingId: string,
): Promise<MeetingSatisfactionAnswer[]> {
  const { data, error } = await supabaseClient
    .from('meeting_satisfaction_answers')
    .select('*')
    .eq('meeting_id', meetingId);

  if (error) {
    console.error('fetchAnswersForMeeting error', error);
    throw error;
  }
  return (data ?? []) as MeetingSatisfactionAnswer[];
}

/**
 * Save / replace all satisfaction answers for a meeting.
 * Strategy: delete old rows for that meeting, then insert the new list.
 */
export async function saveMeetingSatisfaction(
  payload: SaveMeetingSatisfactionInput,
): Promise<void> {
  const { meetingId, patientId, listId, answers } = payload;

  // 1) Delete previous answers for this meeting (idempotent save).
  const { error: deleteError } = await supabaseClient
    .from('meeting_satisfaction_answers')
    .delete()
    .eq('meeting_id', meetingId);

  if (deleteError) {
    console.error('saveMeetingSatisfaction delete error', deleteError);
    throw deleteError;
  }

  if (answers.length === 0) {
    // Nothing to insert; treat as "cleared".
    return;
  }

  type AnswerInput = {
    questionId: string;
    score: SatisfactionScore;
  };

  // 2) Insert new answers
  const rows = answers.map((a: AnswerInput) => ({
    meeting_id: meetingId,
    patient_id: patientId,
    list_id: listId,
    question_id: a.questionId,
    score: a.score,
  }));

  const { error: insertError } = await supabaseClient
    .from('meeting_satisfaction_answers')
    .insert(rows);

  if (insertError) {
    console.error('saveMeetingSatisfaction insert error', insertError);
    throw insertError;
  }
}

/**
 * Calculate average score for a given meeting directly from DB.
 * (Useful for MeetingsTable or patient detail.)
 */
export async function fetchMeetingSatisfactionAverage(
  meetingId: string,
): Promise<number | null> {
  const { data, error } = await supabaseClient
    .from('meeting_satisfaction_answers')
    .select('score')
    .eq('meeting_id', meetingId);

  if (error) {
    console.error('fetchMeetingSatisfactionAverage error', error);
    throw error;
  }

  if (!data || data.length === 0) return null;

  const sum = data.reduce(
    (acc, row: { score: SatisfactionScore | null }) =>
      acc + (row.score ?? 0),
    0,
  );
  return sum / data.length;
}

/**
 * Admin: create a new satisfaction question list for the given org.
 */
export async function createSatisfactionList(params: {
  orgId: string;
  name: string;
}): Promise<MeetingSatisfactionQuestionList> {
  const payload = {
    org_id: params.orgId,
    name: params.name.trim() || 'Yeni Liste',
    is_active: true,
  };

  const { data, error } = await supabaseClient
    .from('meeting_satisfaction_question_lists')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('createSatisfactionList error', error);
    throw error;
  }

  return data as MeetingSatisfactionQuestionList;
}

/**
 * Admin: update attributes of a satisfaction list (e.g. name, is_active).
 */
export async function updateSatisfactionList(params: {
  listId: string;
  patch: {
    name?: string;
    is_active?: boolean;
  };
}): Promise<MeetingSatisfactionQuestionList> {
  const patch: Record<string, unknown> = {};

  if (typeof params.patch.name === 'string') {
    patch.name = params.patch.name.trim() || 'İsmi olmayan liste';
  }
  if (typeof params.patch.is_active === 'boolean') {
    patch.is_active = params.patch.is_active;
  }

  const { data, error } = await supabaseClient
    .from('meeting_satisfaction_question_lists')
    .update(patch)
    .eq('id', params.listId)
    .select('*')
    .single();

  if (error) {
    console.error('updateSatisfactionList error', error);
    throw error;
  }

  return data as MeetingSatisfactionQuestionList;
}

/**
 * Admin: create a new question in a given list.
 */
export async function createSatisfactionQuestion(params: {
  orgId: string;
  listId: string;
  questionText: string;
  sortOrder?: number;
}): Promise<MeetingSatisfactionQuestion> {
  const payload = {
    org_id: params.orgId,
    list_id: params.listId,
    question_text: params.questionText.trim() || 'Yeni soru',
    sort_order: params.sortOrder ?? 0,
    is_active: true,
  };

  const { data, error } = await supabaseClient
    .from('meeting_satisfaction_questions')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('createSatisfactionQuestion error', error);
    throw error;
  }

  return data as MeetingSatisfactionQuestion;
}

/**
 * Admin: update a question in a list (text, order, active flag).
 * We avoid hard delete because answers reference questions with ON DELETE RESTRICT.
 */
export async function updateSatisfactionQuestion(params: {
  questionId: string;
  patch: {
    question_text?: string;
    sort_order?: number;
    is_active?: boolean;
  };
}): Promise<MeetingSatisfactionQuestion> {
  const patch: Record<string, unknown> = {};

  if (typeof params.patch.question_text === 'string') {
    patch.question_text = params.patch.question_text.trim() || 'Boş soru';
  }
  if (typeof params.patch.sort_order === 'number') {
    patch.sort_order = params.patch.sort_order;
  }
  if (typeof params.patch.is_active === 'boolean') {
    patch.is_active = params.patch.is_active;
  }

  const { data, error } = await supabaseClient
    .from('meeting_satisfaction_questions')
    .update(patch)
    .eq('id', params.questionId)
    .select('*')
    .single();

  if (error) {
    console.error('updateSatisfactionQuestion error', error);
    throw error;
  }

  return data as MeetingSatisfactionQuestion;
}
