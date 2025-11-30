// src/features/meetings/api.ts
// Supabase-backed API helpers and React Query hooks for Meetings.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type { MeetingRow, NewMeetingForm, MeetingType } from './types';

export const MEETINGS_QUERY_KEY = ['meetings'] as const;

// Trial detail için: belirli bir deneme hastasına bağlı görüşmeler
export const MEETINGS_BY_TRIAL_QUERY_KEY = (trialId: string) =>
  ['meetings', 'trial', trialId] as const;

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

/**
 * Fetch meetings for a specific trial (deneme hastası).
 * Filters by meeting_type = 'trial' and subject_id = trialId.
 */
export async function fetchMeetingsByTrialId(
  trialId: string,
): Promise<MeetingRow[]> {
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
    .eq('meeting_type', 'trial')
    .eq('subject_id', trialId)
    .order('at', { ascending: false });

  if (error) {
    console.error(
      'Supabase trial meetings fetch error (fetchMeetingsByTrialId):',
      error,
    );
    throw error;
  }

  return (data ?? []) as MeetingRow[];
}

/**
 * Normalize a money string like "1 250", "1.250", "1250,50" into a number.
 * Returns null if empty. Throws if invalid or <= 0.
 */
function parseAmountString(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
  const value = Number(normalized);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      'MEET_STEP_PAYMENT_AMOUNT_INVALID: Geçerli bir ödeme tutarı girilmedi.',
    );
  }

  // Round to 2 decimals
  return Number(value.toFixed(2));
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
    throw new Error('MEET_STEP_PROFILE: ' + profileError.message);
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

  // Ödeme (sadece hasta tipi meeting için anlamlı)
  const paymentAmountNumber = (() => {
    try {
      return parseAmountString(input.paymentAmount);
    } catch (err) {
      // Mesajı yukarı fırlatıyoruz ki UI'da gösterilsin
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('MEET_STEP_PAYMENT_AMOUNT_INVALID');
    }
  })();

  const shouldInsertPayment =
    input.hasPayment &&
    paymentAmountNumber !== null &&
    input.meetingType === 'patient' &&
    !!input.subjectId;

  // 4) Meeting insert – meeting_type ve subject_x alanlarını da gönder
  const { data: insertedMeetings, error: insertError } = await supabaseClient
    .from('meetings')
    .insert({
      org_id: profile.org_id,
      meeting_type: input.meetingType as MeetingType,
      subject_id: input.subjectId,
      subject_name: input.subjectName.trim() || null,

      subject: input.subject.trim() || null,
      note: input.note.trim() || null,
      at: atIso,
      next_at: nextAtIso,
      satisfaction_10: satisfaction,
      // created_by, profiles(id) ile aynı olduğu için direkt user.id
      created_by: user.id,
    })
    .select('id')
    .limit(1);

  if (insertError) {
    console.error('Failed to insert meeting (MEET_STEP_INSERT):', insertError);
    throw new Error('MEET_STEP_INSERT: ' + insertError.message);
  }

  const meetingId = insertedMeetings?.[0]?.id as string | undefined;
  if (!meetingId) {
    console.error(
      'Meeting insert did not return an id (MEET_STEP_INSERT_NO_ID)',
      insertedMeetings,
    );
    throw new Error(
      'MEET_STEP_INSERT_NO_ID: Meeting insert did not return an id',
    );
  }

  // 5) Eğer hasta tipi meeting ve ödeme varsa, meeting_payments tablosuna da kayıt aç
  if (shouldInsertPayment && paymentAmountNumber && input.subjectId) {
    const { error: paymentError } = await supabaseClient
      .from('meeting_payments')
      .insert({
        org_id: profile.org_id,
        meeting_id: meetingId,
        patient_id: input.subjectId,
        amount: paymentAmountNumber,
        // NOTE: method artık CHECK constraint ile kısıtlı.
        // Şimdilik meeting ekranından sadece 'Senet' kaydediyoruz.
        method: 'Senet',
        note: input.paymentNote.trim() || null,
      });

    if (paymentError) {
      console.error(
        'Failed to insert meeting payment (MEET_STEP_PAYMENT_INSERT):',
        paymentError,
      );
      throw new Error(
        'MEET_STEP_PAYMENT_INSERT: ' + paymentError.message,
      );
    }
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
      // Bu invalidation, ['meetings'] ile başlayan tüm queryKey'leri
      // (ör: ['meetings'], ['meetings', 'trial', trialId]) etkileyecek.
      queryClient.invalidateQueries({ queryKey: MEETINGS_QUERY_KEY });
    },
  });
}
