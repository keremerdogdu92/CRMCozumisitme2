// src/features/patients/api/api.patients.update.ts
// Update helpers for SGK fields and invoice status on patients.

import { supabaseClient } from '../../../utils/supabaseClient';
import type { PatientSgkUpdateInput, PatientPaymentMethod } from '../types';
import { parseMoneyToNumber } from './api.core';

/**
 * Update SGK-related fields for a given patient.
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

  const { error } = await supabaseClient
    .from('patients')
    .update({
      sgk_flag: sgkFlag,
      sgk_prescription_received: sgkFlag ? sgkPrescriptionReceived : false,
      sgk_recorded_to_system: sgkFlag ? sgkRecordedToSystem : false,
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
 * Update SGK profile-based reimbursement info for a given patient.
 * Used from the SGK tab "Düzenle" bölümü.
 *
 * - sgkProfileId: SGK profil kodu (ör: 'SGK_YETISKIN_EMEKLI'), boşsa NULL.
 * - sgkExpectedReimbursement: TR formatında toplam beklenen ödeme (örn: "8.478,40"),
 *   boşsa NULL.
 * - sgkExpectedMonth: "yyyy-MM" formatında beklenen ödeme ayı, boşsa NULL.
 */
export async function updatePatientSgkProfileInfo(params: {
  id: string;
  sgkProfileId: string | null;
  sgkExpectedReimbursement: string | null;
  sgkExpectedMonth: string | null;
}): Promise<void> {
  const { id, sgkProfileId, sgkExpectedReimbursement, sgkExpectedMonth } = params;

  const updatePayload: Record<string, unknown> = {};

  // sgk_profile
  if (typeof sgkProfileId !== 'undefined') {
    const trimmed = sgkProfileId ? sgkProfileId.trim() : '';
    updatePayload.sgk_profile = trimmed.length > 0 ? trimmed : null;
  }

  // sgk_expected_reimbursement
  if (typeof sgkExpectedReimbursement !== 'undefined') {
    const raw = sgkExpectedReimbursement ?? '';
    if (!raw.trim()) {
      updatePayload.sgk_expected_reimbursement = null;
    } else {
      updatePayload.sgk_expected_reimbursement = parseMoneyToNumber(
        raw,
        'SGK_EXPECTED_REIMBURSEMENT',
      );
    }
  }

  // sgk_expected_reimbursement_month
  if (typeof sgkExpectedMonth !== 'undefined') {
    const raw = sgkExpectedMonth ?? '';
    if (!raw.trim()) {
      updatePayload.sgk_expected_reimbursement_month = null;
    } else {
      const [yearStr, monthStr] = raw.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        throw new Error('SGK_EXPECTED_MONTH: Geçerli bir ay seçin (yyyy-AA).');
      }
      const date = new Date(Date.UTC(year, month - 1, 15));
      updatePayload.sgk_expected_reimbursement_month = date.toISOString().slice(0, 10);
    }
  }

  const { error } = await supabaseClient
    .from('patients')
    .update(updatePayload)
    .eq('id', id);

  if (error) {
    console.error(
      'Failed to update patient SGK profile info (STEP_UPDATE_SGK_PROFILE):',
      error,
    );
    throw new Error('STEP_UPDATE_SGK_PROFILE: ' + error.message);
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
