// src/features/meetings/api.ts
// Supabase-backed API helpers and React Query hooks for Meetings.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type { MeetingRow, NewMeetingForm } from './types';

export const MEETINGS_QUERY_KEY = ['meetings'] as const;

export async function fetchMeetings(): Promise<MeetingRow[]> {
  const { data, error } = await supabaseClient
    .from('meetings')
    .select(
      `
      id,
      meeting_type,
      subject_id,
      subject_name,
      subject,
      note,
      at,
      next_at,
      satisfaction_10,
      created_at
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase meetings fetch error:', error);
    throw error;
  }

  return (data ?? []) as MeetingRow[];
}

export async function createMeeting(input: NewMeetingForm): Promise<void> {
  // 1) Aktif kullanıcıyı al
  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();
  if (userError) {
    console.error('Failed to get current user (MEET_STEP_USER):', userError);
    throw new Error('MEET_STEP_USER: ' + userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('MEET_STEP_USER: User not authenticated');
  }

  // 2) Profile üzerinden org_id çek
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error(
      'Failed to load profile for org_id (MEET_STEP_PROFILE):',
      profileError,
    );
  }

  if (!profile?.org_id) {
    console.error('Profile org_id is missing (MEET_STEP_NO_ORG)', profile);
    throw new Error('MEET_STEP_NO_ORG: Profile org_id is missing');
  }

  // 3) Form verisini normalize et
  const satisfaction =
    input.satisfaction10.trim() === ''
      ? null
      : Math.min(
          10,
          Math.max(1, Number.parseInt(input.satisfaction10, 10) || 0),
        );

  const atIso = input.at ? new Date(input.at).toISOString() : null;
  const nextAtIso = input.next_at
    ? new Date(input.next_at).toISOString()
    : null;

  // 4) Insert – meeting_type ve subject_x alanlarını da gönder
  const { error: insertError } = await supabaseClient.from('meetings').insert({
    org_id: profile.org_id,
    meeting_type: input.meetingType,
    subject_id: input.subjectId,
    subject_name: input.subjectName.trim() || null,

    subject: input.subject.trim() || null,
    note: input.note.trim() || null,
    at: atIso,
    next_at: nextAtIso,
    satisfaction_10: satisfaction,
    // created_by, profiles(id) ile aynı olduğu için direkt user.id
    created_by: user.id,
  });

  if (insertError) {
    console.error('Failed to insert meeting (MEET_STEP_INSERT):', insertError);
    throw new Error('MEET_STEP_INSERT: ' + insertError.message);
  }
}

/**
 * React Query hooks
 */

export function useMeetingsQuery() {
  return useQuery({
    queryKey: MEETINGS_QUERY_KEY,
    queryFn: fetchMeetings,
  });
}

export function useCreateMeetingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMeeting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEETINGS_QUERY_KEY });
    },
  });
}
