// src/features/patients/api/api.patients.update.ts
// Update helpers for SGK fields, SGK profile info, invoice status, and personal info on patients.

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
      sgk_prescription_received: sgkFlag ? sgkPrescriptionReceived : false,
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
    const parsed = parseMoneyToNumber(
      sgkExpectedReimbursement,
      'sgkExpectedReimbursement',
    );
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
 * Fatura tarihi normalizasyonu.
 * - invoiceIssued = false → her zaman null (tarih temizlenir).
 * - invoiceIssued = true:
 *   - raw boş ise → now().
 *   - "yyyy-MM-dd" ise → o günün 00:00 UTC ISO'su.
 *   - Diğer parse edilebilir değerler → Date(raw).toISOString().
 *   - Parse edilemezse → now().
 */
function normalizeInvoiceIssuedAt(
  invoiceIssued: boolean,
  rawValue: string | null | undefined,
): string | null {
  if (!invoiceIssued) return null;

  if (!rawValue || rawValue.trim().length === 0) {
    return new Date().toISOString();
  }

  const value = rawValue.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value + 'T00:00:00.000Z');
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date().toISOString();
}

/**
 * Update invoice status for a given patient.
 * - UI'dan gelen checkbox + tarih kombinasyonunu DB'ye yazar.
 * - Tarih "yyyy-MM-dd" veya ISO benzeri bir değer olabilir.
 */
export async function updatePatientInvoiceStatus(params: {
  id: string;
  invoiceIssued: boolean;
  invoiceIssuedAt?: string | null;
}): Promise<{
  invoice_issued: boolean;
  invoice_issued_at: string | null;
}> {
  const { id, invoiceIssued, invoiceIssuedAt } = params;

  const effectiveIssuedAt = normalizeInvoiceIssuedAt(
    invoiceIssued,
    invoiceIssuedAt,
  );

  const { data, error } = await supabaseClient
    .from('patients')
    .update({
      invoice_issued: invoiceIssued,
      invoice_issued_at: effectiveIssuedAt,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoice_issued: !!(data as any).invoice_issued,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoice_issued_at:
      ((data as any).invoice_issued_at as string | null) ?? null,
  };
}

/**
 * Update patient personal info (özlük bilgileri).
 * Updates: full_name, phone, national_id, kin_phone, address, archive_code, satisfaction_10, created_at
 */
export async function updatePatientPersonalInfo(params: {
  id: string;
  fullName: string;
  phone: string;
  nationalId: string;
  kinPhone: string;
  address: string;
  archiveCode: string;
  satisfaction10: string; // "1" to "10" or empty
  createdAt?: string; // yyyy-MM-dd format, optional
}): Promise<void> {
  const {
    id,
    fullName,
    phone,
    nationalId,
    kinPhone,
    address,
    archiveCode,
    satisfaction10,
    createdAt,
  } = params;

  // Validation
  const trimmedFullName = fullName.trim();
  if (!trimmedFullName || trimmedFullName.length === 0) {
    throw new Error('FULL_NAME: Ad Soyad zorunludur.');
  }

  const trimmedPhone = phone.trim();
  if (!trimmedPhone || trimmedPhone.length === 0) {
    throw new Error('PHONE: Telefon zorunludur.');
  }

  // Parse satisfaction (1-10 or null)
  let satisfactionValue: number | null = null;
  if (satisfaction10.trim().length > 0) {
    const parsed = parseInt(satisfaction10.trim(), 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 10) {
      satisfactionValue = parsed;
    }
  }

  // Parse created_at (optional)
  let createdAtIso: string | undefined = undefined;
  if (createdAt && createdAt.trim().length > 0) {
    const date = new Date(createdAt);
    if (!Number.isNaN(date.getTime())) {
      createdAtIso = date.toISOString();
    }
  }

  const updatePayload: Record<string, any> = {
    full_name: trimmedFullName,
    phone: trimmedPhone,
    national_id: nationalId.trim() || null,
    kin_phone: kinPhone.trim() || null,
    address: address.trim() || null,
    archive_code: archiveCode.trim() || null,
    satisfaction_10: satisfactionValue,
  };

  if (createdAtIso !== undefined) {
    updatePayload.created_at = createdAtIso;
  }

  const { error } = await supabaseClient
    .from('patients')
    .update(updatePayload)
    .eq('id', id);

  if (error) {
    console.error(
      'Failed to update patient personal info (STEP_UPDATE_PERSONAL_INFO):',
      error,
    );
    throw new Error('STEP_UPDATE_PERSONAL_INFO: ' + error.message);
  }
}

/**
 * Update only patients.sale_total_amount in-place.
 * No columns are moved or renamed — just a simple value update.
 */
export async function updatePatientSaleAmount(params: {
  id: string;
  saleTotalAmount: number | null;
}): Promise<void> {
  const { error } = await supabaseClient
    .from('patients')
    .update({ sale_total_amount: params.saleTotalAmount })
    .eq('id', params.id);

  if (error) {
    console.error('Failed to update sale_total_amount:', error);
    throw new Error('STEP_UPDATE_SALE_AMOUNT: ' + error.message);
  }
}
