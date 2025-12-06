// src/features/patients/patientsImportUtils.ts
// Pure helpers for Patients CSV import: row normalization and mapping to NewPatientForm.
// This does NOT touch Supabase or React Query, so it is easy to reuse & test.

import type { NewPatientForm, PatientPaymentMethodFormValue } from './types';

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
 * Default payment method for legacy CSV imports where payment_method
 * is not provided in the file.
 *
 * For your current legacy patients we treat all as "Nakit" unless the CSV
 * explicitly specifies another method.
 */
const DEFAULT_IMPORT_PAYMENT_METHOD: PatientPaymentMethodFormValue = 'Nakit';

/**
 * Normalize a raw payment method string coming from CSV
 * into a valid PatientPaymentMethodFormValue union.
 * Unknown / empty values fall back to '' (no selection),
 * and the caller may apply a default if needed.
 */
function parsePaymentMethod(
  raw: string | undefined,
): PatientPaymentMethodFormValue {
  if (!raw) return '';
  const v = raw.trim().toLowerCase();
  if (!v) return '';

  // Allow a few TR + EN variants that map to our union literals.
  if (v === 'tim') return 'Tim';
  if (v === 'sivantos') return 'Sivantos';

  // Card / credit card mappings
  if (
    v === 'kredi_kartı' ||
    v === 'kredi kartı' ||
    v === 'kredi karti' ||
    v === 'kart' ||
    v === 'card' ||
    v === 'credit' ||
    v === 'credit_card' ||
    v === 'credit card'
  ) {
    return 'Kredi_Kartı';
  }

  // Cash mappings
  if (v === 'nakit' || v === 'cash') {
    return 'Nakit';
  }

  // Installment / senet mappings
  if (
    v === 'senet' ||
    v === 'taksit' ||
    v === 'installment' ||
    v === 'installments'
  ) {
    return 'Senet';
  }

  // Fallback: leave as "no selection" and let caller handle default.
  return '';
}

/**
 * Try to normalize various legacy date strings into "yyyy-MM-dd".
 *
 * Supported examples:
 * - "2024-11-20"
 * - "20.11.2024"
 * - "20/11/2024"
 *
 * Returns undefined if parsing fails.
 */
function normalizeLegacySaleDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  // Already ISO-like "yyyy-MM-dd" → accept as-is.
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    return trimmed;
  }

  // "dd.MM.yyyy" or "dd/MM/yyyy"
  const dotMatch = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(trimmed);
  if (dotMatch) {
    const day = dotMatch[1].padStart(2, '0');
    const month = dotMatch[2].padStart(2, '0');
    const year = dotMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback: last attempt with Date, but only if it yields a valid date.
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  console.warn('LEGACY_SALE_DATE_NORMALIZE_FAILED', { raw });
  return undefined;
}

/**
 * Map a raw CSV object (header → value) into NewPatientForm.
 * We keep the mapping simple and rely on createPatient(...) to do DB validation.
 *
 * Expected / supported header keys (normalized):
 *   - full_name (zorunlu)           | alternatif: ad_soyad
 *   - phone
 *   - national_id
 *   - kin_phone
 *   - address
 *   - reference_name
 *   - sgk_flag
 *   - sgk_prescription_received
 *   - sgk_recorded_to_system
 *   - payment_method                (opsiyonel; boş ise DEFAULT_IMPORT_PAYMENT_METHOD kullanılır)
 *   - sale_total                    (tercih edilen isim; zorunlu kolondur, değer satırda boş bırakılamaz)
 *   - card_sale_total               (eski isim; sale_total yoksa fallback; yine satırda boş bırakılamaz)
 *   - card_fee_rate
 *   - sale_date                     (opsiyonel; "yyyy-MM-dd" veya "dd.MM.yyyy", legacy tarih)
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

  // Default: SGK yok → false
  const sgkFlag = sgkFlagParsed ?? false;

  const paymentMethodRaw = row['payment_method'];
  let paymentMethod = parsePaymentMethod(paymentMethodRaw);

  // If CSV does not provide a payment method, fall back to a sane default
  // for legacy imports (e.g. all treated as "Nakit").
  if (!paymentMethod) {
    paymentMethod = DEFAULT_IMPORT_PAYMENT_METHOD;
  }

  // Prefer "sale_total" header; fall back to older "card_sale_total" if needed.
  const saleTotalRaw =
    (row['sale_total'] ?? '').trim() ||
    (row['card_sale_total'] ?? '').trim();

  if (!saleTotalRaw) {
    return {
      rowIndex,
      formValues: null,
      error:
        'Satış tutarı için "sale_total" veya "card_sale_total" kolonunda değer bulunmalıdır.',
    };
  }

  const cardFeeRate = (row['card_fee_rate'] ?? '').trim();

  // Optional legacy sale date; normalize to "yyyy-MM-dd".
  const legacySaleDate = normalizeLegacySaleDate(row['sale_date']);

  const formValues: NewPatientForm = {
    fullName,
    phone,
    // SGK üçlüsü
    sgkFlag,
    sgkPrescriptionReceived: sgkFlag ? !!sgkPrescriptionParsed : false,
    sgkRecordedToSystem: sgkFlag ? !!sgkRecordedParsed : false,
    // Payment info
    paymentMethod,
    saleTotal: saleTotalRaw,
    cardFeeRate,
    // Legacy sale date for imports (optional, already normalized if present)
    legacySaleDate,
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
