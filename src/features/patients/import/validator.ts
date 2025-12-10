// src/features/patients/import/validator.ts
// Pure validation and normalization helpers for patients import rows.
// v2.1: supports legacy_unknown payment bucket and does not block import
// when payment_method is missing or unknown.

import { parseMoneyToNumber } from '../api/api.core';
import type {
  PatientsImportIssue,
  PatientsImportNormalizedPayload,
} from './types';

/**
 * Normalize a CSV header key into snake_case.
 * Example: "Full Name" -> "full_name"
 */
export function normalizeHeaderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse boolean-like strings (TR + EN).
 */
export function parseBoolLike(
  raw: string | undefined,
): boolean | null | 'invalid' {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;

  if (['1', 'true', 'evet', 'yes'].includes(v)) return true;
  if (['0', 'false', 'hayir', 'hayır', 'hayr', 'no'].includes(v)) return false;

  return 'invalid';
}

/**
 * Parse dates like "dd.mm.yyyy" or "yyyy-mm-dd" into ISO string with T00:00:00.000Z.
 */
export function parseDateLike(
  raw: string | undefined,
): { value: string | null; invalid: boolean } {
  if (!raw) return { value: null, invalid: false };
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, invalid: false };

  // yyyy-mm-dd
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return { value: `${y}-${m}-${d}T00:00:00.000Z`, invalid: false };
  }

  // dd.mm.yyyy
  const dotMatch = /^(\d{1,2})[.](\d{1,2})[.](\d{4})$/.exec(trimmed);
  if (dotMatch) {
    const day = dotMatch[1].padStart(2, '0');
    const month = dotMatch[2].padStart(2, '0');
    const year = dotMatch[3];
    return { value: `${year}-${month}-${day}T00:00:00.000Z`, invalid: false };
  }

  return { value: null, invalid: true };
}

/**
 * Normalize phone numbers:
 * - Accepts + / 00 prefixed internationals as-is (digits cleaned).
 * - For TR, accepts 10-digit local numbers and prefixes +90.
 */
export function normalizePhone(
  raw: string | undefined,
): { value: string | null; error?: string } {
  if (!raw) {
    return { value: null, error: 'Phone is required.' };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: null, error: 'Phone is required.' };
  }

  // International: keep leading + or 00
  if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
    const digits = trimmed.replace(/[^\d+]/g, '');
    if (digits.length < 8) {
      return { value: null, error: 'Invalid phone format.' };
    }
    return { value: digits };
  }

  // TR local 10 digits → +90XXXXXXXXXX
  if (/^\d{10}$/.test(trimmed)) {
    return { value: `+90${trimmed}` };
  }

  // Other digit-only but not 10 digits → invalid
  if (/^\d+$/.test(trimmed)) {
    return { value: null, error: 'Invalid phone format.' };
  }

  return { value: null, error: 'Invalid phone format.' };
}

/**
 * Normalize payment_method to match patients.payment_method CHECK constraint.
 *
 * Canonical values:
 *   - 'Tim'
 *   - 'Sivantos'
 *   - 'Kredi_Kartı'
 *   - 'Nakit'
 *   - 'Senet'
 *   - 'legacy_unknown' (for historical / unknown payment types)
 *
 * Import v2.1 rule:
 *   - payment_method is NOT required for import.
 *   - If CSV is empty or completely unknown, we bucket as 'legacy_unknown'.
 *   - Unknown non-empty values produce a WARNING, not an error.
 */
function normalizePaymentMethod(
  raw: string | undefined,
): { value: string | null; warning?: string } {
  const allowed = [
    'Tim',
    'Sivantos',
    'Kredi_Kartı',
    'Nakit',
    'Senet',
    'legacy_unknown',
  ] as const;

  // Empty / missing → legacy_unknown bucket (no error, no warning)
  if (!raw || !raw.trim()) {
    return { value: 'legacy_unknown' };
  }

  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase().replace(/\s+/g, '_');

  // Map common human inputs to canonical DB values.
  if (lower === 'nakit' || lower === 'cash') {
    return { value: 'Nakit' };
  }
  if (
    lower === 'kredi_kartı' ||
    lower === 'kredi_karti' ||
    lower === 'kredi_kartı.' ||
    lower === 'kart' ||
    lower === 'card' ||
    lower === 'credit_card' ||
    lower === 'creditcard'
  ) {
    return { value: 'Kredi_Kartı' };
  }
  if (lower === 'senet' || lower === 'taksit' || lower === 'installment') {
    return { value: 'Senet' };
  }
  if (lower === 'tim') {
    return { value: 'Tim' };
  }
  if (lower === 'sivantos') {
    return { value: 'Sivantos' };
  }
  if (lower === 'legacy_unknown') {
    return { value: 'legacy_unknown' };
  }

  // If user already gave canonical value (exact match), accept it.
  if (allowed.includes(trimmed as (typeof allowed)[number])) {
    return { value: trimmed as (typeof allowed)[number] };
  }

  // Fallback: bucket to legacy_unknown but emit a warning so we know there was
  // a non-empty, unmapped payment text.
  return {
    value: 'legacy_unknown',
    warning:
      'Unknown payment_method value in CSV; imported as legacy_unknown (Ödeme).',
  };
}

/**
 * Validate and normalize a single patients CSV row.
 * Produces a PatientsImportNormalizedPayload or issues if invalid.
 */
export function validatePatientsRow(params: {
  rawRow: Record<string, string>;
  orgId: string;
  rowIndex?: number;
}): {
  normalized: PatientsImportNormalizedPayload | null;
  issues: PatientsImportIssue[];
} {
  const { rawRow, orgId, rowIndex = 0 } = params;
  const issues: PatientsImportIssue[] = [];

  // 1) Full name (required)
  const fullName =
    rawRow['full_name']?.trim() || rawRow['ad_soyad']?.trim() || '';
  if (!fullName) {
    issues.push({
      row_index: rowIndex,
      field: 'full_name',
      severity: 'error',
      message: 'Full name is required.',
    });
  }

  // 2) National ID: required, 11 digits
  const nationalIdRaw = (rawRow['national_id'] ?? '').trim();
  let nationalId: string | null = nationalIdRaw || null;

  if (!nationalIdRaw) {
    issues.push({
      row_index: rowIndex,
      field: 'national_id',
      severity: 'error',
      message: 'national_id is required.',
    });
  } else if (!/^\d{11}$/.test(nationalIdRaw)) {
    issues.push({
      row_index: rowIndex,
      field: 'national_id',
      severity: 'error',
      message: 'national_id must be 11 digits.',
    });
  }

  // 3) Phone: required + normalized
  const phoneResult = normalizePhone(rawRow['phone']);
  if (phoneResult.error) {
    issues.push({
      row_index: rowIndex,
      field: 'phone',
      severity: 'error',
      message: phoneResult.error,
    });
  }

  // 4) SGK flags
  const sgkFlagParsed = parseBoolLike(rawRow['sgk_flag']);
  const sgkPrescriptionParsed = parseBoolLike(
    rawRow['sgk_prescription_received'],
  );
  const sgkRecordedParsed = parseBoolLike(rawRow['sgk_recorded_to_system']);

  const sgkFlag =
    sgkFlagParsed === true ? true : sgkFlagParsed === false ? false : false;
  const sgkPrescription =
    sgkPrescriptionParsed === true
      ? true
      : sgkPrescriptionParsed === false
        ? false
        : false;
  const sgkRecorded =
    sgkRecordedParsed === true
      ? true
      : sgkRecordedParsed === false
        ? false
        : false;

  if (sgkFlagParsed === 'invalid') {
    issues.push({
      row_index: rowIndex,
      field: 'sgk_flag',
      severity: 'error',
      message: 'Invalid boolean value for sgk_flag.',
    });
  }
  if (sgkPrescriptionParsed === 'invalid') {
    issues.push({
      row_index: rowIndex,
      field: 'sgk_prescription_received',
      severity: 'error',
      message: 'Invalid boolean value for sgk_prescription_received.',
    });
  }
  if (sgkRecordedParsed === 'invalid') {
    issues.push({
      row_index: rowIndex,
      field: 'sgk_recorded_to_system',
      severity: 'error',
      message: 'Invalid boolean value for sgk_recorded_to_system.',
    });
  }

  // 5) payment_method: NOT required anymore.
  //    Missing/empty → legacy_unknown; unknown non-empty → legacy_unknown + warning.
  const paymentMethodResult = normalizePaymentMethod(rawRow['payment_method']);
  if (paymentMethodResult.warning) {
    issues.push({
      row_index: rowIndex,
      field: 'payment_method',
      severity: 'warning',
      message: paymentMethodResult.warning,
    });
  }

  // 6) sale_total: required; we also accept legacy "card_sale_total" header.
  const saleTotalRaw =
    (rawRow['sale_total'] ?? '').trim() ||
    (rawRow['card_sale_total'] ?? '').trim();
  let saleTotalAmount: number | null = null;

  if (saleTotalRaw) {
    try {
      const parsedSale = parseMoneyToNumber(saleTotalRaw, 'SALE_TOTAL_AMOUNT');
      saleTotalAmount = parsedSale;
    } catch (err) {
      issues.push({
        row_index: rowIndex,
        field: 'sale_total',
        severity: 'error',
        message:
          (err as Error)?.message || 'sale_total is invalid. Expected number.',
      });
    }
  } else {
    issues.push({
      row_index: rowIndex,
      field: 'sale_total',
      severity: 'error',
      message: 'sale_total is required.',
    });
  }

  // 7) card_fee_rate (%); optional; if invalid → warning and ignored.
  const cardFeeRateRaw = (rawRow['card_fee_rate'] ?? '').trim();
  let cardFeeRate: number | null = null;
  let cardFeeAmount: number | null = null;

  if (cardFeeRateRaw) {
    const fee = Number(cardFeeRateRaw.replace(',', '.'));
    if (Number.isFinite(fee) && fee > 0) {
      cardFeeRate = fee;
      if (saleTotalAmount != null) {
        cardFeeAmount = Number(((saleTotalAmount * fee) / 100).toFixed(2));
      }
    } else {
      issues.push({
        row_index: rowIndex,
        field: 'card_fee_rate',
        severity: 'warning',
        message: 'card_fee_rate is invalid; ignored.',
      });
    }
  }

  // 8) Optional sale_date; if valid, used for invoice_issued_at + created_at.
  const saleDateResult = parseDateLike(rawRow['sale_date']);
  if (saleDateResult.invalid) {
    issues.push({
      row_index: rowIndex,
      field: 'sale_date',
      severity: 'warning',
      message: 'sale_date could not be parsed; skipped.',
    });
  }

  // NOTE: Duplicate patient check (by national_id) is handled server-side
  // in the import processor using patients table; not here.

  const hasErrors = issues.some((i) => i.severity === 'error');
  if (hasErrors) {
    return { normalized: null, issues };
  }

  const normalized: PatientsImportNormalizedPayload = {
    org_id: orgId,
    full_name: fullName,
    phone: phoneResult.value ?? '',
    national_id: nationalId,
    kin_phone: (rawRow['kin_phone'] ?? '').trim() || null,
    address: (rawRow['address'] ?? '').trim() || null,
    sgk_flag: sgkFlag,
    sgk_prescription_received: sgkFlag ? sgkPrescription : false,
    sgk_recorded_to_system: sgkFlag ? sgkRecorded : false,
    payment_method: paymentMethodResult.value,
    sale_total_amount: saleTotalAmount,
    card_fee_rate: cardFeeRate,
    card_fee_amount: cardFeeAmount,
    invoice_issued: false,
    invoice_issued_at: saleDateResult.value,
    created_at: saleDateResult.value,
  };

  return { normalized, issues };
}
