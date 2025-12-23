// src/features/references/api.gifts.ts
// Summary: Supabase-backed API helpers and React Query keys for reference gift/commission tracking.
// - Fetch gifts for a reference (admin view).
// - Create / update / soft-delete (if deleted_at exists) or hard-delete fallback.
// - Designed to be schema-tolerant: adjust column names in select/insert mappings if your DB differs.

import { supabaseClient } from '../../utils/supabaseClient';

// -----------------------------
// Types (adjust if your DB differs)
// -----------------------------

export type ReferenceGiftKind = 'gift' | 'commission' | 'payment';

export type ReferenceGiftRow = {
  id: string;
  org_id: string;
  reference_id: string;

  kind: ReferenceGiftKind | null;

  /**
   * Amount in TL. Keep numeric in DB; we parse to number for UI.
   */
  amount: number | null;

  /**
   * Optional: payment method text (cash/card/tim/sivantos etc.)
   */
  method: string | null;

  /**
   * Optional: free-form note
   */
  note: string | null;

  /**
   * When this gift/payment happened (date or timestamptz)
   */
  gift_at: string | null;

  created_at: string;

  /**
   * Soft delete marker (optional, depends on your schema)
   */
  deleted_at?: string | null;
};

export type NewReferenceGiftInput = {
  referenceId: string;
  kind: ReferenceGiftKind | null;
  amount: number | null;
  method: string;
  note: string;
  giftAt: string; // ISO or YYYY-MM-DD
};

// -----------------------------
// React Query keys
// -----------------------------

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

function toIsoOrNull(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  // Allow YYYY-MM-DD to pass as-is; DB can cast.
  // If it looks like ISO already, keep it.
  return s;
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

  // If you have deleted_at soft delete, default filter is "not deleted"
  const includeDeleted = Boolean(opts?.includeDeleted);

  let q = supabaseClient
    .from('reference_gifts')
    .select(
      `
      id,
      org_id,
      reference_id,
      kind,
      amount,
      method,
      note,
      gift_at,
      created_at,
      deleted_at
    `,
    )
    .eq('reference_id', id)
    .order('gift_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (!includeDeleted) {
    // If deleted_at column does not exist, Supabase will error.
    // In that case you should remove this filter after you confirm schema.
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
      kind: (row.kind ?? null) as ReferenceGiftKind | null,
      amount: toNumberOrNull(row.amount),
      method: (row.method ?? null) as string | null,
      note: (row.note ?? null) as string | null,
      gift_at: (row.gift_at ?? null) as string | null,
      created_at: row.created_at as string,
      deleted_at: row.deleted_at ?? null,
    })) ?? []
  );
}

export async function createReferenceGift(
  input: NewReferenceGiftInput,
): Promise<void> {
  const payload = {
    reference_id: input.referenceId,
    kind: input.kind,
    amount: input.amount,
    method: input.method.trim() || null,
    note: input.note.trim() || null,
    gift_at: toIsoOrNull(input.giftAt),
  };

  const { error } = await supabaseClient.from('reference_gifts').insert(payload);

  if (error) {
    console.error('Supabase reference_gifts insert error (REFG_CREATE):', error);
    throw new Error('REFG_CREATE: ' + error.message);
  }
}

export async function updateReferenceGift(
  id: string,
  patch: Partial<Omit<NewReferenceGiftInput, 'referenceId'>> & {
    kind?: ReferenceGiftKind | null;
    amount?: number | null;
  },
): Promise<void> {
  const giftId = id.trim();
  if (!giftId) throw new Error('REFG_UPDATE: Missing gift id');

  const payload: any = {};
  if ('kind' in patch) payload.kind = patch.kind ?? null;
  if ('amount' in patch) payload.amount = patch.amount ?? null;
  if ('method' in patch) payload.method = patch.method?.trim() || null;
  if ('note' in patch) payload.note = patch.note?.trim() || null;
  if ('giftAt' in patch) payload.gift_at = toIsoOrNull(patch.giftAt ?? '');

  const { error } = await supabaseClient
    .from('reference_gifts')
    .update(payload)
    .eq('id', giftId);

  if (error) {
    console.error('Supabase reference_gifts update error (REFG_UPDATE):', error);
    throw new Error('REFG_UPDATE: ' + error.message);
  }
}

/**
 * Prefer soft delete if deleted_at exists; otherwise hard delete.
 * If your schema enforces soft delete only, remove the hard delete fallback.
 */
export async function deleteReferenceGift(id: string): Promise<void> {
  const giftId = id.trim();
  if (!giftId) throw new Error('REFG_DELETE: Missing gift id');

  // Try soft delete first
  const soft = await supabaseClient
    .from('reference_gifts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', giftId);

  if (!soft.error) return;

  // Fallback to hard delete if deleted_at column not present
  const hard = await supabaseClient.from('reference_gifts').delete().eq('id', giftId);

  if (hard.error) {
    console.error('Supabase reference_gifts delete error (REFG_DELETE):', hard.error);
    throw new Error('REFG_DELETE: ' + hard.error.message);
  }
}
