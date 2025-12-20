// src/features/meetings/api.satisfaction.ts
// Summary: Supabase API helpers for meeting satisfaction surveys.

import { supabaseClient } from '../../utils/supabaseClient';
import type {
  MeetingSatisfactionQuestionList,
  MeetingSatisfactionQuestion,
  MeetingSatisfactionAnswer,
  SaveMeetingSatisfactionInput,
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
  return data ?? [];
}

/**
 * Fetch active questions for a given list, ordered by sort_order.
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
  return data ?? [];
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
  return data ?? [];
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

  // 2) Insert new answers
  const rows = answers.map((a) => ({
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

  const sum = data.reduce((acc, row) => acc + (row.score ?? 0), 0);
  return sum / data.length;
}
