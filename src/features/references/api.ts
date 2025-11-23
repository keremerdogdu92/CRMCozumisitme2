// src/features/references/api.ts
// Supabase-backed API helpers and React Query keys for references data.

import { supabaseClient } from '../../utils/supabaseClient';
import type { NewReferenceForm, ReferenceRow, ReferenceGroup } from './types';

export const REFERENCES_QUERY_KEY = ['references'] as const;

export async function fetchReferences(): Promise<ReferenceRow[]> {
  const { data, error } = await supabaseClient
    .from('references')
    .select(
      `
      id,
      full_name,
      "group",
      last_meet_at,
      next_meet_at,
      note,
      created_at
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase references fetch error:', error);
    throw error;
  }

  return (
    data?.map((row) => ({
      ...row,
      group: (row.group ?? null) as ReferenceGroup | null,
    })) ?? []
  );
}

/**
 * Lightweight search helper for Meeting subject picker.
 * Returns only id + full_name, RLS ile zaten kendi org'unu görür.
 */
type ReferenceSearchRow = {
  id: string;
  full_name: string;
};

export async function searchReferencesByName(
  term: string,
): Promise<ReferenceSearchRow[]> {
  const q = term.trim();
  if (!q) return [];

  const { data, error } = await supabaseClient
    .from('references')
    .select('id, full_name')
    .ilike('full_name', `%${q}%`)
    .order('full_name', { ascending: true })
    .limit(20);

  if (error) {
    console.error(
      'Supabase references search error (REF_STEP_SEARCH):',
      error,
    );
    throw new Error('REF_STEP_SEARCH: ' + error.message);
  }

  return (data ?? []) as ReferenceSearchRow[];
}

export async function createReference(
  input: NewReferenceForm,
): Promise<void> {
  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();
  if (userError) {
    console.error('Failed to get current user (REF_STEP_USER):', userError);
    throw new Error('REF_STEP_USER: ' + userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('REF_STEP_USER: User not authenticated');
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error(
      'Failed to load profile for org_id (REF_STEP_PROFILE):',
      profileError,
    );
    throw new Error('REF_STEP_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    console.error('Profile org_id is missing (REF_STEP_NO_ORG)', profile);
    throw new Error('REF_STEP_NO_ORG: Profile org_id is missing');
  }

  const { error: insertError } = await supabaseClient
    .from('references')
    .insert({
      org_id: profile.org_id,
      full_name: input.fullName.trim() || null,
      group: input.group || null,
      last_meet_at: input.lastMeetAt
        ? new Date(input.lastMeetAt).toISOString()
        : null,
      next_meet_at: input.nextMeetAt
        ? new Date(input.nextMeetAt).toISOString()
        : null,
      note: input.note.trim() || null,
    });

  if (insertError) {
    console.error(
      'Failed to insert reference (REF_STEP_INSERT):',
      insertError,
    );
    throw new Error('REF_STEP_INSERT: ' + insertError.message);
  }
}
