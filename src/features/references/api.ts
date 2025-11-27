// src/features/references/api.ts
// Supabase-backed API helpers and React Query keys for references data.

import { supabaseClient } from '../../utils/supabaseClient';
import type {
  NewReferenceForm,
  ReferenceRow,
  ReferenceGroup,
  ReferenceCommissionScheme,
} from './types';

export const REFERENCES_QUERY_KEY = ['references'] as const;

export async function fetchReferences(): Promise<ReferenceRow[]> {
  const { data, error } = await supabaseClient
    .from('references')
    .select(
      `
      id,
      full_name,
      "group",
      phone,
      commission_scheme,
      commission_percent,
      commission_fixed,
      is_active,
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
    data?.map((row: any) => ({
      id: row.id as string,
      full_name: row.full_name ?? null,
      group: (row.group ?? null) as ReferenceGroup | null,
      phone: (row.phone ?? null) as string | null,
      commission_scheme: (row.commission_scheme ??
        null) as ReferenceCommissionScheme,
      commission_percent:
        row.commission_percent !== null && row.commission_percent !== undefined
          ? Number(row.commission_percent)
          : null,
      commission_fixed:
        row.commission_fixed !== null && row.commission_fixed !== undefined
          ? Number(row.commission_fixed)
          : null,
      is_active: Boolean(
        row.is_active === null || row.is_active === undefined
          ? true
          : row.is_active,
      ),
      last_meet_at: row.last_meet_at ?? null,
      next_meet_at: row.next_meet_at ?? null,
      note: row.note ?? null,
      created_at: row.created_at as string,
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

  const scheme = input.commissionScheme;

  const commission_percent =
    scheme === 'percent' ? (input.commissionPercent || 0) / 100 : null;
  const commission_fixed =
    scheme === 'fixed' ? input.commissionFixed || 0 : null;

  const { error: insertError } = await supabaseClient
    .from('references')
    .insert({
      org_id: profile.org_id,
      full_name: input.fullName.trim() || null,
      group: input.group || null,
      phone: input.phone.trim() || null,
      commission_scheme: scheme,
      commission_percent,
      commission_fixed,
      is_active: input.isActive,
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
