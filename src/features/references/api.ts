// src/features/references/api.ts
// Summary: Supabase-backed API helpers and React Query keys for references data.
// Integrations:
// - Supabase table: public.references
// - Supabase RPCs:
//   - public.soft_delete_references(p_id, p_reason)
//   - public.restore_references(p_id)
// v2.3.0:
// - ADD: softDeleteReference + restoreReference helpers (RPC-based, no hard delete).
// - KEEP: SoftDeleteMode-aware list query (active/deleted/all) for admin screen.
// - KEEP: Search helpers filter out deleted/inactive references for staff-safe pickers.
// - KEEP: deleted_at mapping.

import { supabaseClient } from '../../utils/supabaseClient';
import type {
  NewReferenceForm,
  ReferenceRow,
  ReferenceGroup,
  ReferenceCommissionScheme,
  SoftDeleteMode,
} from './types';

export const REFERENCES_QUERY_KEY = (mode: SoftDeleteMode) =>
  ['references', mode] as const;

type ReferenceDbRow = Record<string, unknown>;

export async function fetchReferences(
  mode: SoftDeleteMode,
): Promise<ReferenceRow[]> {
  let q = supabaseClient
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
      contact_interval_days,
      last_meet_at,
      next_meet_at,
      note,
      created_at,
      deleted_at
    `,
    )
    .order('created_at', { ascending: false });

  if (mode === 'active') {
    q = q.is('deleted_at', null);
  } else if (mode === 'deleted') {
    q = q.not('deleted_at', 'is', null);
  }

  const { data, error } = await q;

  if (error) {
    console.error('Supabase references fetch error:', error);
    throw error;
  }

  return (
    (data as ReferenceDbRow[] | null | undefined)?.map((row) => ({
      id: row.id as string,
      full_name: (row.full_name as string | null) ?? null,
      group: (row.group ?? null) as ReferenceGroup | null,
      phone: (row.phone ?? null) as string | null,
      commission_scheme: (row.commission_scheme ?? null) as ReferenceCommissionScheme,
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
      contact_interval_days:
        row.contact_interval_days !== null && row.contact_interval_days !== undefined
          ? Number(row.contact_interval_days)
          : null,
      last_meet_at: (row.last_meet_at as string | null) ?? null,
      next_meet_at: (row.next_meet_at as string | null) ?? null,
      note: (row.note as string | null) ?? null,
      created_at: row.created_at as string,
      deleted_at: (row.deleted_at as string | null) ?? null,
    })) ?? []
  );
}

/**
 * Soft delete a reference via RPC.
 * Security model:
 * - UI must not hard delete.
 * - RPC is org-scoped on DB side via current_user_org_id().
 */
export async function softDeleteReference(
  id: string,
  reason?: string | null,
): Promise<void> {
  const referenceId = (id ?? '').trim();
  if (!referenceId) {
    throw new Error('REF_SOFT_DELETE: Missing reference id');
  }

  const { error } = await supabaseClient.rpc('soft_delete_references', {
    p_id: referenceId,
    p_reason: reason ?? null,
  });

  if (error) {
    console.error('Supabase soft_delete_references RPC error:', error);
    throw new Error('REF_SOFT_DELETE: ' + error.message);
  }
}

/**
 * Restore a soft-deleted reference via RPC.
 */
export async function restoreReference(id: string): Promise<void> {
  const referenceId = (id ?? '').trim();
  if (!referenceId) {
    throw new Error('REF_RESTORE: Missing reference id');
  }

  const { error } = await supabaseClient.rpc('restore_references', {
    p_id: referenceId,
  });

  if (error) {
    console.error('Supabase restore_references RPC error:', error);
    throw new Error('REF_RESTORE: ' + error.message);
  }
}

/**
 * Lightweight search helper for Meeting subject picker.
 * Staff should only see active + not-deleted references.
 * RLS should also enforce this on DB side (recommended).
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
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('full_name', { ascending: true })
    .limit(20);

  if (error) {
    console.error('Supabase references search error (REF_STEP_SEARCH):', error);
    throw new Error('REF_STEP_SEARCH: ' + error.message);
  }

  return (data ?? []) as ReferenceSearchRow[];
}

export async function createReference(input: NewReferenceForm): Promise<void> {
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
  const commission_fixed = scheme === 'fixed' ? input.commissionFixed || 0 : null;

  const contactInterval =
    input.contactIntervalDays.trim() === ''
      ? null
      : Number(input.contactIntervalDays);

  const { error: insertError } = await supabaseClient.from('references').insert({
    org_id: profile.org_id,
    full_name: input.fullName.trim() || null,
    group: input.group || null,
    phone: input.phone.trim() || null,
    commission_scheme: scheme,
    commission_percent,
    commission_fixed,
    is_active: input.isActive,
    contact_interval_days:
      Number.isFinite(contactInterval) && contactInterval! > 0 ? contactInterval : null,
    last_meet_at: input.lastMeetAt ? new Date(input.lastMeetAt).toISOString() : null,
    next_meet_at: input.nextMeetAt ? new Date(input.nextMeetAt).toISOString() : null,
    note: input.note.trim() || null,
    deleted_at: null,
  });

  if (insertError) {
    console.error('Failed to insert reference (REF_STEP_INSERT):', insertError);
    throw new Error('REF_STEP_INSERT: ' + insertError.message);
  }
}

/**
 * Lightweight single-reference loader for detail views (trials, patients).
 * Staff should only see active + not-deleted references.
 */
export type ReferenceLiteForTrial = {
  id: string;
  full_name: string | null;
};

export async function fetchReferenceLiteById(
  id: string,
): Promise<ReferenceLiteForTrial | null> {
  if (!id) return null;

  const { data, error } = await supabaseClient
    .from('references')
    .select('id, full_name')
    .eq('id', id)
    .is('deleted_at', null)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Supabase reference-lite fetch error:', error);
    throw error;
  }

  if (!data) return null;

  return {
    id: data.id as string,
    full_name: (data.full_name ?? null) as string | null,
  };
}
