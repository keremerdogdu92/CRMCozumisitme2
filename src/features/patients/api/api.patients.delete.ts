// src/features/patients/api/api.patients.delete.ts
// Soft delete helper for patients (sets deleted_at / deleted_by / delete_reason).

import { supabaseClient } from '../../../utils/supabaseClient';

/**
 * Soft delete a patient:
 * - Sets deleted_at = now()
 * - Sets deleted_by = current user id (if available)
 * - Optionally records a short delete_reason
 *
 * RLS ensures:
 * - Only same-org authenticated users can update this row.
 * - Hard DELETE is reserved for service_role (cron/purge).
 */
export async function softDeletePatient(params: {
  id: string;
  reason?: string;
}): Promise<void> {
  const { id, reason } = params;

  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError) {
    console.error(
      'Failed to get current user for soft delete (STEP_DELETE_USER):',
      userError,
    );
  }

  const deletedBy = userData?.user?.id ?? null;

  const payload: Record<string, any> = {
    deleted_at: new Date().toISOString(),
    delete_reason: reason && reason.trim().length > 0 ? reason.trim() : null,
  };

  if (deletedBy) {
    payload.deleted_by = deletedBy;
  }

  const { error } = await supabaseClient
    .from('patients')
    .update(payload)
    .eq('id', id);

  if (error) {
    console.error(
      'Failed to soft delete patient (STEP_SOFT_DELETE):',
      error,
    );
    throw new Error('STEP_SOFT_DELETE: ' + error.message);
  }
}
