// src/features/patients/api/api.patients.update.ts
// Update helpers for SGK fields and invoice status on patients.

import { supabaseClient } from '../../../utils/supabaseClient';
import type { PatientSgkUpdateInput, PatientPaymentMethod } from '../types';
import { parseMoneyToNumber } from './api.core';

/**
 * Update SGK-related fields for a given patient.
 *
 * Behavior:
 * - sgk_flag false ise:
 *   * sgk_prescription_received = false
 *   * sgk_recorded_to_system = false
 *   * sgk_recorded_to_system_at = NULL
 * - sgk_flag true ve sgkRecordedToSystem true ise:
 *   * sgk_recorded_to_system_at = now()
 * - sgk_flag true ve sgkRecordedToSystem false ise:
 *   * sgk_recorded_to_system_at = NULL
 */
export async function updatePatientSgkFields(
  params: PatientSgkUpdateInput,
): Promise<void> {
  const {
    id,
    sgkFlag,
    sgkPrescriptionReceived,
    sgkRecordedToSystem,
    sgkPrescriptionNo,
  } = params;

  const nextRecordedToSystemAt =
    sgkFlag && sgkRecordedToSystem ? new Date().toISOString() : null;

  const { error } = await supabaseClient
    .from('patients')
    .update({
      sgk_flag: sgkFlag,
      sgk_prescription_received: sgkFlag
        ? sgkPrescriptionReceived
        : false,
      sgk_recorded_to_system: sgkFlag ? sgkRecordedToSystem : false,
      sgk_recorded_to_system_at: nextRecordedToSystemAt,
      sgk_prescription_no: sgkPrescriptionNo.trim() || null,
    })
    .eq('id', id);

  if (error) {
    console.error(
      'Failed to update patient SGK fields (STEP_UPDATE_SGK):',
      error,
    );
    throw new Error('STEP_UPDATE_SGK: ' + error.message);
  }
}

/**
 * Update invoice status for a given patient.
 * Returns the latest invoice_issued/invoice_issued_at values.
 */
export async function updatePatientInvoiceStatus(params: {
  id: string;
  invoiceIssued: boolean;
}): Promise<{
  invoice_issued: boolean;
  invoice_issued_at: string | null;
}> {
  const { id, invoiceIssued } = params;
  const nextIssuedAt = invoiceIssued ? new Date().toISOString() : null;

  const { data, error } = await supabaseClient
    .from('patients')
    .update({
      invoice_issued: invoiceIssued,
      invoice_issued_at: invoiceIssued ? nextIssuedAt : null,
    })
    .eq('id', id)
    .select('invoice_issued, invoice_issued_at')
    .single();

  if (error) {
    console.error(
      'Failed to update patient invoice status (STEP_UPDATE_INVOICE):',
      error,
    );
    throw new Error('STEP_UPDATE_INVOICE: ' + error.message);
  }

  return {
    invoice_issued: !!(data as any).invoice_issued,
    invoice_issued_at:
      ((data as any).invoice_issued_at as string | null) ?? null,
  };
}
