// src/features/patients/api/api.patients.update.ts
// Update helpers for SGK fields, SGK profile info and invoice status on patients.

import { supabaseClient } from '../../../utils/supabaseClient';
import type { PatientSgkUpdateInput, PatientPaymentMethod } from '../types';
import { parseMoneyToNumber } from './api.core';

type PatientSgkUpdateWithRecordedAt = PatientSgkUpdateInput & {
  sgkRecordedToSystemAt?: string | null;
};

function normalizeRecordedAt(
  sgkFlag: boolean,
  sgkRecordedToSystem: boolean,
  rawValue: string | null | undefined,
): string | null {
  if (!sgkFlag || !sgkRecordedToSystem) {
    return null;
  }

  if (!rawValue || rawValue.trim().length === 0) {
    return new Date().toISOString();
  }

  const value = rawValue.trim();

  // "yyyy-MM-dd" formatı için hızlı yol.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value + 'T00:00:00.000Z');
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  // Diğer tarih formatları (ISO vb.) için fallback.
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  // Hiçbiri parse edilemezse son çare: now.
  return new Date().toISOString();
}

/**
 * Update SGK-related fields for a given patient.
 * Artık sgk_recorded_to_system_at kolonunu da günceller.
 */
export async function updatePatientSgkFields(
  params: PatientSgkUpdateWithRecordedAt,
): Promise<void> {
  const {
    id,
    sgkFlag,
    sgkPrescriptionReceived,
    sgkRecordedToSystem,
    sgkPrescriptionNo,
    sgkRecordedToSystemAt,
  } = params;

  const effectiveRecordedAt = normalizeRecordedAt(
    sgkFlag,
    sgkRecordedToSystem,
    sgkRecordedToSystemAt,
  );

  const { error } = await supabaseClient
    .from('patients')
    .update({
      sgk_flag: sgkFlag,
      sgk_prescription_received: sgkFlag
        ? sgkPrescriptionReceived
        : false,
      sgk_recorded_to_system: sgkFlag ? sgkRecordedToSystem : false,
      sgk_recorded_to_system_at: effectiveRecordedAt,
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
 * Update SGK profile-based expected reimbursement info.
 * Kullanım: SGK profili sekmesindeki "SGK Profilini Kaydet" butonu.
 */
export async function updatePatientSgkProfileInfo(params: {
  id: string;
  sgkProfileId: string | null;
  sgkExpectedReimbursement: string | null;
  sgkExpectedMonth: string | null; // "yyyy-MM" veya null
}): Promise<void> {
  const {
    id,
    sgkProfileId,
    sgkExpectedReimbursement,
    sgkExpectedMonth,
  } = params;

  // Beklenen tutarı TR formatlı string'ten number'a çevir.
  let expectedAmount: number | null = null;
  if (sgkExpectedReimbursement && sgkExpectedReimbursement.trim().length > 0) {
    const parsed = parseMoneyToNumber(sgkExpectedReimbursement);
    expectedAmount =
      parsed != null && !Number.isNaN(parsed) ? parsed : null;
  }

  // "yyyy-MM" → "yyyy-MM-15" (date kolonuna yazılacak).
  let expectedMonthDate: string | null = null;
  if (sgkExpectedMonth && sgkExpectedMonth.trim().length > 0) {
    const [yearStr, monthStr] = sgkExpectedMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      month >= 1 &&
      month <= 12
    ) {
      const d = new Date(Date.UTC(year, month - 1, 15));
      // Supabase tarafında date kolonu olduğu için sadece YYYY-MM-DD kısmını bırakmak yeterli.
      expectedMonthDate = d.toISOString().slice(0, 10);
    }
  }

  const { error } = await supabaseClient
    .from('patients')
    .update({
      sgk_profile: sgkProfileId,
      sgk_expected_reimbursement: expectedAmount,
      sgk_expected_reimbursement_month: expectedMonthDate,
    })
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
