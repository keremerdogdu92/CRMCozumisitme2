// src/features/meetings/api.satisfaction.ts
// Summary: Supabase API helpers for meeting satisfaction surveys.
// - Active list & question fetch (for meeting form).
// - Full list/question management (for Settings card).
// - Per-meeting answer save/load and average calculation.
// - All inserts include org_id, resolved from current user's profile.

import { supabaseClient } from '../../utils/supabaseClient';
import type {
  MeetingSatisfactionQuestionList,
  MeetingSatisfactionQuestion,
  MeetingSatisfactionAnswer,
  SaveMeetingSatisfactionInput,
  SatisfactionScore,
} from './meetingSatisfactionTypes';

/**
 * Shared helper: resolve org_id from current auth user via profiles.
 */
async function getCurrentOrgId(): Promise<string> {
  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();
  if (userError) {
    console.error(
      'SATISFACTION_STEP_USER: Failed to get current user',
      userError,
    );
    throw new Error(
      'SATISFACTION_STEP_USER: ' + userError.message,
    );
  }
  const user = userData.user;
  if (!user) {
    throw new Error('SATISFACTION_STEP_USER: User not authenticated');
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error(
      'SATISFACTION_STEP_PROFILE: Failed to load profile for org_id',
      profileError,
    );
    throw new Error(
      'SATISFACTION_STEP_PROFILE: ' + profileError.message,
    );
  }

  if (!profile?.org_id) {
    console.error(
      'SATISFACTION_STEP_NO_ORG: Profile org_id is missing',
      profile,
    );
    throw new Error(
      'SATISFACTION_STEP_NO_ORG: Profile org_id is missing',
    );
  }

  return profile.org_id as string;
}

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
 * Fetch ALL survey lists for settings screen (active + passive).
 */
export async function fetchAllSatisfactionLists(): Promise<MeetingSatisfactionQuestionList[]> {
  const { data, error } = await supabaseClient
    .from('meeting_satisfaction_question_lists')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('fetchAllSatisfactionLists error', error);
    throw error;
  }
  return (data ?? []) as MeetingSatisfactionQuestionList[];
}

/**
 * Fetch active questions for a given list, ordered by sort_order.
 * Used by meeting form (anket UI).
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
 * Fetch ALL questions (active + passive) for settings screen.
 */
export async function fetchAllQuestionsForList(
  listId: string,
): Promise<MeetingSatisfactionQuestion[]> {
  const { data, error } = await supabaseClient
    .from('meeting_satisfaction_questions')
    .select('*')
    .eq('list_id', listId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('fetchAllQuestionsForList error', error);
    throw error;
  }
  return (data ?? []) as MeetingSatisfactionQuestion[];
}

/**
 * Create a new question list for current org.
 */
export async function createSatisfactionList(input: {
  orgId: string;
  name: string;
}): Promise<MeetingSatisfactionQuestionList> {
  const payload = {
    org_id: input.orgId,
    name: input.name.trim(),
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
 * Update an existing list (name / is_active).
 */
export async function updateSatisfactionList(input: {
  listId: string;
  patch: {
    name?: string;
    is_active?: boolean;
  };
}): Promise<MeetingSatisfactionQuestionList> {
  const patchDb: Record<string, unknown> = {};
  if (typeof input.patch.name === 'string') {
    patchDb.name = input.patch.name.trim();
  }
  if (typeof input.patch.is_active === 'boolean') {
    patchDb.is_active = input.patch.is_active;
  }

  const { data, error } = await supabaseClient
    .from('meeting_satisfaction_question_lists')
    .update(patchDb)
    .eq('id', input.listId)
    .select('*')
    .single();

  if (error) {
    console.error('updateSatisfactionList error', error);
    throw error;
  }

  return data as MeetingSatisfactionQuestionList;
}

/**
 * Create a new question for a given list in current org.
 */
export async function createSatisfactionQuestion(input: {
  orgId: string;
  listId: string;
  questionText: string;
  sortOrder?: number;
}): Promise<MeetingSatisfactionQuestion> {
  const payload = {
    org_id: input.orgId,
    list_id: input.listId,
    question_text: input.questionText.trim(),
    sort_order: input.sortOrder ?? 0,
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
 * Update a question (text / order / is_active).
 */
export async function updateSatisfactionQuestion(input: {
  questionId: string;
  patch: {
    question_text?: string;
    sort_order?: number;
    is_active?: boolean;
  };
}): Promise<MeetingSatisfactionQuestion> {
  const patchDb: Record<string, unknown> = {};
  if (typeof input.patch.question_text === 'string') {
    patchDb.question_text = input.patch.question_text.trim();
  }
  if (typeof input.patch.sort_order === 'number') {
    patchDb.sort_order = input.patch.sort_order;
  }
  if (typeof input.patch.is_active === 'boolean') {
    patchDb.is_active = input.patch.is_active;
  }

  const { data, error } = await supabaseClient
    .from('meeting_satisfaction_questions')
    .update(patchDb)
    .eq('id', input.questionId)
    .select('*')
    .single();

  if (error) {
    console.error('updateSatisfactionQuestion error', error);
    throw error;
  }

  return data as MeetingSatisfactionQuestion;
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
 * - org_id is resolved from current user's profile.
 */
export async function saveMeetingSatisfaction(
  payload: SaveMeetingSatisfactionInput,
): Promise<void> {
  const { meetingId, patientId, listId, answers } = payload;

  // Org id needed for NOT NULL org_id column
  const orgId = await getCurrentOrgId();

  // 1) Delete previous answers for this meeting (idempotent save).
  const { error: deleteError } = await supabaseClient
    .from('meeting_satisfaction_answers')
    .delete()
    .eq('meeting_id', meetingId);

  if (deleteError) {
    console.error(
      'saveMeetingSatisfaction delete error',
      deleteError,
    );
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
    org_id: orgId,
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
    console.error(
      'saveMeetingSatisfaction insert error',
      insertError,
    );
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
    console.error(
      'fetchMeetingSatisfactionAverage error',
      error,
    );
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
