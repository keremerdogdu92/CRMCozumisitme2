// src/features/meetings/api.ts
// Summary: Supabase-backed API helpers and React Query hooks for Meetings.
//
// Patch v2.6:
// - createMeeting() now returns the created meetingId (string) instead of void.
//   This enables "save meeting first, then save survey" UX without hacks.
// - useCreateMeetingMutation() is updated accordingly; callers can await mutateAsync()
//   and receive meetingId.
// - Query invalidation behavior is kept the same.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type {
  MeetingAccessoryDraft,
  MeetingAccessoryRow,
  MeetingRow,
  NewMeetingForm,
  MeetingType,
} from './types';
import { useCurrentProfile } from '../auth/useCurrentProfile';

export const MEETINGS_QUERY_KEY = ['meetings'] as const;

// Trial detail için: belirli bir deneme hastasına bağlı görüşmeler
export const MEETINGS_BY_TRIAL_QUERY_KEY = (trialId: string) =>
  ['meetings', 'trial', trialId] as const;

// Patient detail için: belirli bir hastaya bağlı görüşmeler
export const MEETINGS_BY_PATIENT_QUERY_KEY = (patientId: string) =>
  ['meetings', 'patient', patientId] as const;

export const MEETING_ACCESSORIES_BY_MEETING_QUERY_KEY = (
  meetingId: string,
) => ['meeting-accessories', meetingId] as const;

export async function fetchMeetings(
  opts?: { includeReference: boolean },
): Promise<MeetingRow[]> {
  const includeReference = opts?.includeReference ?? false;

  let query = supabaseClient
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
    );

  // Non-admin kullanıcılar için referans görüşmelerini hiç çekme
  if (!includeReference) {
    query = query.neq('meeting_type', 'reference');
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

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
 * Fetch meetings for a specific patient (hasta).
 * Filters by meeting_type = 'patient' and subject_id = patientId.
 */
export async function fetchMeetingsByPatientId(
  patientId: string,
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
    .eq('meeting_type', 'patient')
    .eq('subject_id', patientId)
    .order('at', { ascending: false });

  if (error) {
    console.error(
      'Supabase patient meetings fetch error (fetchMeetingsByPatientId):',
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

function parseMoneyAllowZero(raw: string): number {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return 0;
  const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Number(value.toFixed(2));
}

export async function insertMeetingAccessoriesForMeeting(
  orgId: string,
  meetingId: string,
  patientId: string,
  drafts: MeetingAccessoryDraft[] | undefined,
): Promise<MeetingAccessoryRow[]> {
  if (!drafts || drafts.length === 0) return [];

  const normalized = drafts
    .map((draft) => {
      const type = draft.type ?? 'Diğer';
      const hasAnyValue =
        (draft.customName ?? '').trim() !== '' ||
        (draft.costPrice ?? '').trim() !== '' ||
        (draft.salePrice ?? '').trim() !== '';

      if (!hasAnyValue) return null;

      const name =
        type === 'Diğer'
          ? (draft.customName ?? '').trim() || 'Diğer'
          : type;

      return {
        org_id: orgId,
        meeting_id: meetingId,
        patient_id: patientId,
        name,
        cost_price: parseMoneyAllowZero(draft.costPrice ?? ''),
        sale_price: parseMoneyAllowZero(draft.salePrice ?? ''),
      };
    })
    .filter((row): row is NonNullable<typeof row> => !!row);

  if (normalized.length === 0) return [];

  const { data, error } = await supabaseClient
    .from('meeting_accessories')
    .insert(normalized)
    .select('*');

  if (error) {
    console.error(
      'insertMeetingAccessoriesForMeeting insert error:',
      error,
    );
    throw error;
  }

  return (data ?? []) as MeetingAccessoryRow[];
}

export async function fetchMeetingAccessoriesByMeetingId(
  meetingId: string,
): Promise<MeetingAccessoryRow[]> {
  if (!meetingId) return [];

  const { data, error } = await supabaseClient
    .from('meeting_accessories')
    .select(
      `
      id,
      meeting_id,
      patient_id,
      org_id,
      name,
      cost_price,
      sale_price,
      created_at
    `,
    )
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(
      'fetchMeetingAccessoriesByMeetingId query error:',
      error,
    );
    throw error;
  }

  return (data ?? []) as MeetingAccessoryRow[];
}

/**
 * Creates a meeting and returns its id (meetingId).
 */
export async function createMeeting(input: NewMeetingForm): Promise<string> {
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
  const nextAtIso = input.next_at ? new Date(input.next_at).toISOString() : null;

  // Ödeme (sadece hasta tipi meeting için anlamlı)
  const paymentAmountNumber = (() => {
    try {
      return parseAmountString(input.paymentAmount);
    } catch (err) {
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

  const shouldInsertAccessories =
    input.meetingType === 'patient' &&
    !!input.subjectId &&
    (input.accessories ?? []).length > 0;

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

  if (shouldInsertAccessories && input.subjectId) {
    try {
      await insertMeetingAccessoriesForMeeting(
        profile.org_id,
        meetingId,
        input.subjectId,
        input.accessories,
      );
    } catch (accErr) {
      console.error(
        'Failed to insert meeting accessories (MEET_STEP_ACCESSORIES_INSERT):',
        accErr,
      );
      if (accErr instanceof Error) {
        throw new Error(
          'MEET_STEP_ACCESSORIES_INSERT: ' + accErr.message,
        );
      }
      throw accErr;
    }
  }

  return meetingId;
}

/**
 * React Query hooks
 */

export function useMeetingsQuery() {
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const isAdmin = profile?.role === 'admin';

  return useQuery({
    queryKey: [
      ...MEETINGS_QUERY_KEY,
      isAdmin ? 'with-reference' : 'no-reference',
    ],
    queryFn: () => fetchMeetings({ includeReference: !!isAdmin }),
    enabled: !profileLoading,
  });
}

export function useCreateMeetingMutation() {
  const queryClient = useQueryClient();

  return useMutation<string, Error, NewMeetingForm>({
    mutationFn: createMeeting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEETINGS_QUERY_KEY });
    },
  });
}
