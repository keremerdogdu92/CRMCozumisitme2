// src/features/patients/patientsImportUtils.ts
// Pure helpers for Patients CSV import: row normalization and mapping to NewPatientForm.
// This does NOT touch Supabase or React Query, so it is easy to reuse & test.

import type { NewPatientForm } from './types';

export type PatientsCsvRowObj = {
  [key: string]: string;
};

export type PatientsImportRowResult = {
  rowIndex: number;
  formValues: NewPatientForm | null;
  error: string | null;
};

/**
 * Small helper to normalize header names to a common form.
 * We lower-case and replace spaces with underscores.
 */
export function normalizeHeaderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse a "bool-like" string (TR + EN).
 * Returns:
 *   true  → for: '1', 'true', 'evet', 'yes'
 *   false → for: '0', 'false', 'hayir', 'hayır', 'no'
 *   null  → if empty or unknown
 */
function parseBoolLike(raw: string | undefined): boolean | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();

  if (!v) return null;

  if (['1', 'true', 'evet', 'yes'].includes(v)) return true;
  if (['0', 'false', 'hayir', 'hayır', 'no'].includes(v)) return false;

  return null;
}

/**
 * Map a raw CSV object (header → value) into NewPatientForm.
 * We keep the mapping simple and rely on createPatient(...) to do DB validation.
 *
 * Expected / supported header keys (normalized):
 *   - full_name (zorunlu)
 *   - phone
 *   - national_id
 *   - kin_phone
 *   - address
 *   - reference_name
 *   - sgk_flag
 *   - sgk_prescription_received
 *   - sgk_recorded_to_system
 *   - payment_method
 *   - card_sale_total
 *   - card_fee_rate
 */
export function mapCsvRowToNewPatientForm(params: {
  row: PatientsCsvRowObj;
  rowIndex: number;
}): PatientsImportRowResult {
  const { row, rowIndex } = params;

  // Required: full_name
  const fullName =
    row['full_name']?.trim() ||
    row['ad_soyad']?.trim() || // küçük kolaylık: TR başlık desteği
    '';

  if (!fullName) {
    return {
      rowIndex,
      formValues: null,
      error: 'Ad Soyad (full_name / ad_soyad) alanı zorunludur.',
    };
  }

  const phone = (row['phone'] ?? '').trim();
  const nationalId = (row['national_id'] ?? '').trim();
  const kinPhone = (row['kin_phone'] ?? '').trim();
  const address = (row['address'] ?? '').trim();
  const referenceName = (row['reference_name'] ?? '').trim();

  const sgkFlagRaw = row['sgk_flag'];
  const sgkPrescriptionRaw = row['sgk_prescription_received'];
  const sgkRecordedRaw = row['sgk_recorded_to_system'];

  const sgkFlagParsed = parseBoolLike(sgkFlagRaw);
  const sgkPrescriptionParsed = parseBoolLike(sgkPrescriptionRaw);
  const sgkRecordedParsed = parseBoolLike(sgkRecordedRaw);

  // Varsayılan: SGK yok → false
  const sgkFlag = sgkFlagParsed ?? false;

  const paymentMethod = (row['payment_method'] ?? '').trim();
  const cardSaleTotal = (row['card_sale_total'] ?? '').trim();
  const cardFeeRate = (row['card_fee_rate'] ?? '').trim();

  const formValues: NewPatientForm = {
    fullName,
    phone,
    // SGK üçlüsü
    sgkFlag,
    sgkPrescriptionReceived: sgkFlag ? !!sgkPrescriptionParsed : false,
    sgkRecordedToSystem: sgkFlag ? !!sgkRecordedParsed : false,
    // Ödeme bilgileri (createPatient bunları zaten string olarak bekliyor)
    paymentMethod,
    cardSaleTotal,
    cardFeeRate,
    // Referans: CSV'den sadece isim alıyoruz, ID'yi boş bırakıyoruz
    referenceId: null,
    referenceName: referenceName || '',
    // Kimlik / adres
    nationalId,
    kinPhone,
    address,
  };

  return {
    rowIndex,
    formValues,
    error: null,
  };
}
