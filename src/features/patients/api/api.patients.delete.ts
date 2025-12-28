// src/features/patients/api/api.patients.delete.ts
// Summary: Soft delete + restore helpers for patients.
// Integrations:
// - Calls DB RPCs defined in DB/schema/patients/patients.sql:
//   - public.soft_delete_patients(p_id uuid, p_reason text)
//   - public.restore_patients(p_id uuid)
// - deleted_by stamping is handled by DB trigger public.trg_soft_delete_set_deleted_by().
// - Org scoping is enforced server-side via public.current_user_org_id() inside the RPCs.
//
// IMPORTANT:
// - Do not UPDATE deleted_* columns directly from UI. Keep behavior canonical via RPCs.

import { supabaseClient } from '../../../utils/supabaseClient';

/**
 * Soft delete a patient via RPC.
 * Idempotent: if already deleted, RPC updates 0 rows and returns successfully.
 */
export async function softDeletePatient(params: {
  id: string;
  reason?: string;
}): Promise<void> {
  const { id, reason } = params;

  if (!id) {
    throw new Error('PATIENT_SOFT_DELETE_INVALID_ID: id is required.');
  }

  const trimmedReason =
    reason && reason.trim().length > 0 ? reason.trim() : null;

  const { error } = await supabaseClient.rpc('soft_delete_patients', {
    p_id: id,
    p_reason: trimmedReason,
  });

  if (error) {
    console.error('Failed to soft delete patient (RPC soft_delete_patients):', error);
    throw new Error('PATIENT_SOFT_DELETE_RPC_FAILED: ' + error.message);
  }
}

/**
 * Restore (un-delete) a patient via RPC.
 * Idempotent: if not deleted, RPC updates 0 rows and returns successfully.
 */
export async function restorePatient(params: { id: string }): Promise<void> {
  const { id } = params;

  if (!id) {
    throw new Error('PATIENT_RESTORE_INVALID_ID: id is required.');
  }

  const { error } = await supabaseClient.rpc('restore_patients', {
    p_id: id,
  });

  if (error) {
    console.error('Failed to restore patient (RPC restore_patients):', error);
    throw new Error('PATIENT_RESTORE_RPC_FAILED: ' + error.message);
  }
}
