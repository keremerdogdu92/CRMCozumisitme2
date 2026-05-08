// src/features/patients/import/legacyDevicesValidator.ts
// Pure validation + normalization helpers for LEGACY patient-device CSV imports.
// This is separate from patients_import validator and only knows about:
// patient_national_id, device_brand, device_model, ear_side, serial_no, sold_at, device_price.

import { parseMoneyToNumber } from '../api/api.core';

export type LegacyDeviceImportIssueSeverity = 'error' | 'warning';

export type LegacyDeviceImportIssue = {
  row_index: number;
  field: string;
  severity: LegacyDeviceImportIssueSeverity;
  message: string;
};

export type LegacyDeviceImportSide = 'R' | 'L' | 'Tek' | 'Çift';

export type LegacyDeviceImportNormalizedPayload = {
  org_id: string;
  patient_national_id: string;
  device_brand: string;
  device_model: string;
  ear_side: LegacyDeviceImportSide;
  serial_no: string | null;
  sold_at: string | null;        // ISO string (T00:00:00.000Z) or null
  device_price: number | null;   // total legacy price for this row (device(s) + accessories)
};

/**
 * Normalize header keys to a canonical snake_case form.
 * Example: "Patient National ID" -> "patient_national_id"
 */
export function normalizeHeaderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse boolean-like strings just in case we later add flags.
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
 * Parse dates like "dd.mm.yyyy" or "yyyy-mm-dd".
 * We stick to the same rules used by patients import.
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
 * Normalize ear_side ("R", "L", "Tek", "Çift") into a canonical value.
 * Turkish inputs are accepted (Sağ / Sol / Çift / Tek).
 */
export function normalizeEarSide(
  raw: string | undefined,
): { value: LegacyDeviceImportSide | null; error?: string } {
  if (!raw) {
    return { value: null, error: 'ear_side is required.' };
  }

  const trimmed = raw.trim().toLowerCase();

  if (['r', 'sağ', 'sag', 'right'].includes(trimmed)) {
    return { value: 'R' };
  }
  if (['l', 'sol', 'left'].includes(trimmed)) {
    return { value: 'L' };
  }
  if (['tek', 'single'].includes(trimmed)) {
    return { value: 'Tek' };
  }
  if (['çift', 'cift', 'pair', 'both'].includes(trimmed)) {
    return { value: 'Çift' };
  }

  return {
    value: null,
    error: 'Invalid ear_side. Allowed: R, L, Tek, Çift.',
  };
}

/**
 * Normalize device_price (string) into a number (using shared money parser).
 */
export function normalizeDevicePrice(
  raw: string | undefined,
): { value: number | null; error?: string } {
  if (!raw) {
    return { value: null };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: null };
  }

  try {
    const parsed = parseMoneyToNumber(trimmed, 'LEGACY_DEVICE_PRICE');
    return { value: parsed };
  } catch (err) {
    return {
      value: null,
      error:
        (err as Error)?.message ||
        'device_price is invalid. Expected a numeric value.',
    };
  }
}

/**
 * Validate and normalize a single legacy device CSV row.
 * This does NOT touch real devices; it only produces a normalized payload
 * for patients_legacy_devices_import_rows.normalized_payload.
 */
export function validateLegacyDeviceRow(params: {
  rawRow: Record<string, string>;
  orgId: string;
  rowIndex?: number;
}): {
  normalized: LegacyDeviceImportNormalizedPayload | null;
  issues: LegacyDeviceImportIssue[];
} {
  const { rawRow, orgId, rowIndex = 0 } = params;
  const issues: LegacyDeviceImportIssue[] = [];

  // 1) Patient national id (required, 11 digits)
  const patientNationalIdRaw = (rawRow['patient_national_id'] ?? '').trim();
  const patientNationalId: string | null = patientNationalIdRaw || null;

  if (!patientNationalIdRaw) {
    issues.push({
      row_index: rowIndex,
      field: 'patient_national_id',
      severity: 'error',
      message: 'patient_national_id is required.',
    });
  } else if (!/^\d{11}$/.test(patientNationalIdRaw)) {
    issues.push({
      row_index: rowIndex,
      field: 'patient_national_id',
      severity: 'error',
      message: 'patient_national_id must be 11 digits.',
    });
  }

  // 2) Device brand (required)
  const brandRaw = (rawRow['device_brand'] ?? '').trim();
  if (!brandRaw) {
    issues.push({
      row_index: rowIndex,
      field: 'device_brand',
      severity: 'error',
      message: 'device_brand is required.',
    });
  }

  // 3) Device model (required)
  const modelRaw = (rawRow['device_model'] ?? '').trim();
  if (!modelRaw) {
    issues.push({
      row_index: rowIndex,
      field: 'device_model',
      severity: 'error',
      message: 'device_model is required.',
    });
  }

  // 4) Ear side (required, mapped to canonical)
  const earSideResult = normalizeEarSide(rawRow['ear_side']);
  if (earSideResult.error) {
    issues.push({
      row_index: rowIndex,
      field: 'ear_side',
      severity: 'error',
      message: earSideResult.error,
    });
  }

  // 5) Serial no (optional)
  const serialRaw = (rawRow['serial_no'] ?? '').trim();
  const serialNo = serialRaw || null;

  // 6) Sold at (optional, warning if invalid)
  const soldAtResult = parseDateLike(rawRow['sold_at']);
  if (soldAtResult.invalid) {
    issues.push({
      row_index: rowIndex,
      field: 'sold_at',
      severity: 'warning',
      message: 'sold_at could not be parsed; skipped.',
    });
  }

  // 7) Device price (optional)
  const devicePriceResult = normalizeDevicePrice(rawRow['device_price']);
  if (devicePriceResult.error) {
    issues.push({
      row_index: rowIndex,
      field: 'device_price',
      severity: 'warning',
      message: devicePriceResult.error,
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  if (hasErrors) {
    return { normalized: null, issues };
  }

  const normalized: LegacyDeviceImportNormalizedPayload = {
    org_id: orgId,
    patient_national_id: patientNationalId as string,
    device_brand: brandRaw,
    device_model: modelRaw,
    ear_side: earSideResult.value as LegacyDeviceImportSide,
    serial_no: serialNo,
    sold_at: soldAtResult.value,
    device_price: devicePriceResult.value,
  };

  return { normalized, issues };
}
