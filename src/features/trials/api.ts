// src/features/trials/api.ts
// Supabase-backed API helpers and React Query keys for trial (deneme) data.

import { supabaseClient } from '../../utils/supabaseClient';
import type { TrialRow, NewTrialForm } from './types';

export const TRIALS_QUERY_KEY = ['trials'] as const;

export async function fetchTrials(): Promise<TrialRow[]> {
  const { data, error } = await supabaseClient
    .from('trials')
    .select(
      `
      id,
      full_name,
      phone,
      first_meet_at,
      next_meet_at,
      created_at,
      reference_id
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase trials fetch error:', error);
    throw error;
  }

  return data ?? [];
}

export async function createTrial(input: NewTrialForm): Promise<void> {
  // 1) Current user
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) {
    console.error('Failed to get current user (TRIAL_STEP_USER):', userError);
    throw new Error('TRIAL_STEP_USER: ' + userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('TRIAL_STEP_USER: User not authenticated');
  }

  // 2) Profile → org_id
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Failed to load profile for org_id (TRIAL_STEP_PROFILE):', profileError);
    throw new Error('TRIAL_STEP_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    console.error('Profile org_id is missing (TRIAL_STEP_NO_ORG)', profile);
    throw new Error('TRIAL_STEP_NO_ORG: Profile org_id is missing');
  }

  // 3) Insert trial
  const { error: insertError } = await supabaseClient.from('trials').insert({
    org_id: profile.org_id,
    full_name: input.fullName.trim(),
    phone: input.phone.trim() || null,
    first_meet_at: input.firstMeetAt ? new Date(input.firstMeetAt).toISOString() : null,
    next_meet_at: input.nextMeetAt ? new Date(input.nextMeetAt).toISOString() : null,
    reference_id: null, // reference seçimi sonraki iterasyonda eklenecek
  });

  if (insertError) {
    console.error('Failed to insert trial (TRIAL_STEP_INSERT):', insertError);
    throw new Error('TRIAL_STEP_INSERT: ' + insertError.message);
  }
}
