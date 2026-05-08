// src/features/patients/api/api.saleBreakdown.ts
// Patient-level sale breakdown API: multi-method payment lines per patient.
//
// - fetchPatientSaleBreakdown: read all breakdown rows for a patient.
// - savePatientSaleBreakdown: replace all rows for a patient with the given list.

import { supabaseClient } from '../../../utils/supabaseClient';
import type {
  PatientSaleBreakdownRow,
  UpsertPatientSaleBreakdownItem,
  PatientPaymentMethod,
} from '../types';
import { parseMoneyToNumber } from './api.core';

type PatientSaleBreakdownDbRow = Record<string, unknown>;

/**
 * Fetch sale breakdown rows for a given patient.
 */
export async function fetchPatientSaleBreakdown(
  patientId: string,
): Promise<PatientSaleBreakdownRow[]> {
  if (!patientId) return [];

  const { data, error } = await supabaseClient
    .from('patient_sale_breakdown')
    .select(
      [
        'id',
        'org_id',
        'patient_id',
        'method',
        'amount',
        'note',
        'created_at',
        'created_by',
      ].join(', '),
    )
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(
      'Supabase fetchPatientSaleBreakdown error:',
      error,
    );
    throw error;
  }

  return ((data ?? []) as unknown as PatientSaleBreakdownDbRow[]).map((row) => ({
    id: row.id as string,
    org_id: row.org_id as string,
    patient_id: row.patient_id as string,
    method: row.method as PatientPaymentMethod,
    amount: Number(row.amount),
    note: (row.note as string | null) ?? null,
    created_at: row.created_at as string,
    created_by: (row.created_by as string | null) ?? null,
  }));
}

/**
 * Replace all sale breakdown rows for a given patient with the provided list.
 *
 * Typical flow in UI:
 * - User edits a grid of lines (method + amount + note).
 * - On save, call this function with the current list.
 *
 * Notes:
 * - Empty or zero amounts are ignored.
 * - All rows for this patient are deleted before insert to keep it simple.
 */
export async function savePatientSaleBreakdown(params: {
  patientId: string;
  items: UpsertPatientSaleBreakdownItem[];
}): Promise<PatientSaleBreakdownRow[]> {
  const { patientId, items } = params;

  if (!patientId) {
    throw new Error('BREAKDOWN_SAVE: patientId is required.');
  }

  // Get org_id and current user for created_by
  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError) {
    console.error(
      'BREAKDOWN_SAVE: failed to get current user:',
      userError,
    );
    throw new Error(
      'BREAKDOWN_SAVE_USER: ' + userError.message,
    );
  }

  const user = userData.user;
  if (!user) {
    throw new Error('BREAKDOWN_SAVE_USER: User not authenticated');
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error(
      'BREAKDOWN_SAVE: failed to load profile for org_id:',
      profileError,
    );
    throw new Error(
      'BREAKDOWN_SAVE_PROFILE: ' + profileError.message,
    );
  }

  if (!profile?.org_id) {
    console.error(
      'BREAKDOWN_SAVE: profile org_id is missing',
      profile,
    );
    throw new Error(
      'BREAKDOWN_SAVE_NO_ORG: Profile org_id is missing',
    );
  }

  const orgId = profile.org_id as string;

  // Normalize + filter valid items
  const payload: {
    org_id: string;
    patient_id: string;
    method: PatientPaymentMethod;
    amount: number;
    note: string | null;
    created_by: string | null;
  }[] = [];

  items.forEach((item, index) => {
    const fieldCode = `BREAKDOWN_AMOUNT_${index + 1}`;
    const rawAmount = (item.amount ?? '').trim();
    if (!rawAmount) {
      return; // skip empty lines
    }

    const amount = parseMoneyToNumber(rawAmount, fieldCode);
    if (amount <= 0) {
      return; // skip non-positive after parse
    }

    if (!item.method) {
      throw new Error(
        `BREAKDOWN_METHOD_${index + 1}: Ödeme yöntemi zorunludur.`,
      );
    }

    payload.push({
      org_id: orgId,
      patient_id: patientId,
      method: item.method,
      amount,
      note: item.note?.trim() || null,
      created_by: user.id,
    });
  });

  // Wrap in a simple "delete then insert" sequence.
  // RLS + single-tenant org_id filter should protect cross-org access.
  const { error: deleteError } = await supabaseClient
    .from('patient_sale_breakdown')
    .delete()
    .eq('org_id', orgId)
    .eq('patient_id', patientId);

  if (deleteError) {
    console.error(
      'BREAKDOWN_SAVE: failed to delete existing breakdown rows:',
      deleteError,
    );
    throw new Error(
      'BREAKDOWN_SAVE_DELETE: ' + deleteError.message,
    );
  }

  if (payload.length === 0) {
    // No rows to insert; return empty list
    return [];
  }

  const { data, error: insertError } = await supabaseClient
    .from('patient_sale_breakdown')
    .insert(payload)
    .select(
      [
        'id',
        'org_id',
        'patient_id',
        'method',
        'amount',
        'note',
        'created_at',
        'created_by',
      ].join(', '),
    )
    .order('created_at', { ascending: true });

  if (insertError) {
    console.error(
      'BREAKDOWN_SAVE: failed to insert breakdown rows:',
      insertError,
    );
    throw new Error(
      'BREAKDOWN_SAVE_INSERT: ' + insertError.message,
    );
  }

  return ((data ?? []) as unknown as PatientSaleBreakdownDbRow[]).map((row) => ({
    id: row.id as string,
    org_id: row.org_id as string,
    patient_id: row.patient_id as string,
    method: row.method as PatientPaymentMethod,
    amount: Number(row.amount),
    note: (row.note as string | null) ?? null,
    created_at: row.created_at as string,
    created_by: (row.created_by as string | null) ?? null,
  }));
}
