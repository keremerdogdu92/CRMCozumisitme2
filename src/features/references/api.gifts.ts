// src/features/references/api.gifts.ts
// Summary: Supabase-backed API helpers and React Query keys for reference gift/commission tracking.
// - Table: public.reference_gifts (gift_type, amount, gift_note, gift_at, deleted_at).
// - Fetch gifts for a reference (default: active rows only).
// - Create / update / soft-delete (deleted_at).
// - Admin-only writes enforced by RLS policies in DB.
//
// v1.1.0:
// - Aligns API mappings with DB schema: gift_type/gift_note/gift_at.
// - Insert now includes org_id by loading from profiles.

import { supabaseClient } from '../../utils/supabaseClient';

export type ReferenceGiftType = 'other' | 'gift' | 'commission';

export type ReferenceGiftRow = {
  id: string;
  org_id: string;
  reference_id: string;

  gift_type: string; // DB uses text; we keep string for forwards compatibility
  amount: number | null;
  gift_note: string | null;

  /**
   * Stored as DATE in DB.
   */
  gift_at: string;

  created_at: string;
  deleted_at: string | null;
};

export type NewReferenceGiftInput = {
  referenceId: string;
  giftType: ReferenceGiftType | string;
  amount: number | null;
  giftNote: string;
  /**
   * UI value: YYYY-MM-DD (recommended) or ISO; DB column is DATE.
   * Empty -> DB default (today UTC).
   */
  giftAt: string;
};

export const REFERENCE_GIFTS_QUERY_KEY = (referenceId: string) =>
  ['reference-gifts', referenceId] as const;

// -----------------------------
// Helpers
// -----------------------------

function toNumberOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeDateForDb(value: string): string | null {
  const s = value.trim();
  if (!s) return null;

  // Prefer YYYY-MM-DD.
  // If user passes ISO, we take the first 10 chars.
  if (s.length >= 10) return s.slice(0, 10);

  return s;
}

async function requireCurrentOrgId(): Promise<string> {
  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError) {
    console.error('Failed to get current user (REFG_USER):', userError);
    throw new Error('REFG_USER: ' + userError.message);
  }

  const user = userData.user;
  if (!user) {
    throw new Error('REFG_USER: User not authenticated');
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Failed to load profile org_id (REFG_PROFILE):', profileError);
    throw new Error('REFG_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    console.error('Profile org_id missing (REFG_NO_ORG):', profile);
    throw new Error('REFG_NO_ORG: Profile org_id is missing');
  }

  return profile.org_id as string;
}

// -----------------------------
// API
// -----------------------------

export async function fetchReferenceGiftsByReferenceId(
  referenceId: string,
  opts?: { includeDeleted?: boolean },
): Promise<ReferenceGiftRow[]> {
  const id = referenceId.trim();
  if (!id) return [];

  const includeDeleted = Boolean(opts?.includeDeleted);

  let q = supabaseClient
    .from('reference_gifts')
    .select(
      `
      id,
      org_id,
      reference_id,
      gift_type,
      amount,
      gift_note,
      gift_at,
      created_at,
      deleted_at
    `,
    )
    .eq('reference_id', id)
    .order('gift_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (!includeDeleted) {
    q = q.is('deleted_at', null);
  }

  const { data, error } = await q;

  if (error) {
    console.error('Supabase reference_gifts fetch error (REFG_FETCH):', error);
    throw new Error('REFG_FETCH: ' + error.message);
  }

  return (
    data?.map((row: any) => ({
      id: row.id as string,
      org_id: row.org_id as string,
      reference_id: row.reference_id as string,
      gift_type: (row.gift_type ?? 'other') as string,
      amount: toNumberOrNull(row.amount),
      gift_note: (row.gift_note ?? null) as string | null,
      gift_at: (row.gift_at ?? null) as string,
      created_at: row.created_at as string,
      deleted_at: (row.deleted_at ?? null) as string | null,
    })) ?? []
  );
}

export async function createReferenceGift(
  input: NewReferenceGiftInput,
): Promise<void> {
  const orgId = await requireCurrentOrgId();

  const payload = {
    org_id: orgId,
    reference_id: input.referenceId,
    gift_type: (input.giftType || 'other').trim(),
    amount: input.amount,
    gift_note: input.giftNote.trim() || null,
    gift_at: normalizeDateForDb(input.giftAt), // null -> DB default (today UTC)
  };

  const { error } = await supabaseClient.from('reference_gifts').insert(payload);

  if (error) {
    console.error('Supabase reference_gifts insert error (REFG_CREATE):', error);
    throw new Error('REFG_CREATE: ' + error.message);
  }
}

export async function updateReferenceGift(
  id: string,
  patch: Partial<
    Omit<NewReferenceGiftInput, 'referenceId'> & { deletedAt?: string | null }
  >,
): Promise<void> {
  const giftId = id.trim();
  if (!giftId) throw new Error('REFG_UPDATE: Missing gift id');

  const payload: any = {};

  if ('giftType' in patch) payload.gift_type = (patch.giftType || 'other').trim();
  if ('amount' in patch) payload.amount = patch.amount ?? null;
  if ('giftNote' in patch) payload.gift_note = patch.giftNote?.trim() || null;
  if ('giftAt' in patch) payload.gift_at = normalizeDateForDb(patch.giftAt ?? '') ?? null;
  if ('deletedAt' in patch) payload.deleted_at = patch.deletedAt ?? null;

  const { error } = await supabaseClient
    .from('reference_gifts')
    .update(payload)
    .eq('id', giftId);

  if (error) {
    console.error('Supabase reference_gifts update error (REFG_UPDATE):', error);
    throw new Error('REFG_UPDATE: ' + error.message);
  }
}

export async function softDeleteReferenceGift(id: string): Promise<void> {
  const giftId = id.trim();
  if (!giftId) throw new Error('REFG_DELETE: Missing gift id');

  const { error } = await supabaseClient
    .from('reference_gifts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', giftId);

  if (error) {
    console.error('Supabase reference_gifts soft delete error (REFG_DELETE):', error);
    throw new Error('REFG_DELETE: ' + error.message);
  }
}
