// src/features/patients/api/api.import.ts
// Patients CSV import pipeline + React Query mutation wrapper.
//
// Design:
//  - Parse CSV on the client using parseSimpleCsv.
//  - For each row, map to NewPatientForm via patientsImportUtils.
//  - Call existing createPatient(...) for each valid row (sequentially).
//  - Collect per-row errors and return a summary for UI.
//
// This avoids guessing the patients DB schema; we reuse the same
// code path as the normal "Yeni Hasta" form.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseSimpleCsv } from '../../../utils/csvUtils';
import type { NewPatientForm } from '../types';
import { PATIENTS_QUERY_KEY } from './api.core';
import { createPatient } from './api.patients';
import {
  mapCsvRowToNewPatientForm,
  normalizeHeaderKey,
  type PatientsCsvRowObj,
} from '../patientsImportUtils';

export type PatientsImportRowError = {
  rowIndex: number;
  message: string;
};

export type PatientsImportSummary = {
  totalRows: number;
  importedCount: number;
  errorCount: number;
  rowErrors: PatientsImportRowError[];
};

/**
 * Import patients from a CSV file by reusing the existing createPatient flow.
 *
 * Expected header names (case-insensitive, spaces allowed):
 *   - full_name            (zorunlu)  | alternatif: ad_soyad
 *   - phone
 *   - national_id
 *   - kin_phone
 *   - address
 *   - reference_name
 *   - sgk_flag
 *   - sgk_prescription_received
 *   - sgk_recorded_to_system
 *   - payment_method        (opsiyonel; boş ise importer "Nakit" yapar)
 *   - sale_total            (tercih edilen isim)
 *   - card_sale_total       (eski isim; sale_total yoksa fallback)
 *   - card_fee_rate
 *
 * CSV'den gelen hastalar, iş akışı gereği fiilen "faturası kesilmiş" kabul
 * edildiği için createPatient(...) çağrısına setInvoiceIssuedTrue: true
 * opsiyonu ile gidiyoruz.
 */
export async function importPatientsFromCsv(
  file: File,
): Promise<PatientsImportSummary> {
  const text = await file.text();
  const { headers, rows } = parseSimpleCsv(text);

  if (headers.length === 0 || rows.length === 0) {
    throw new Error('CSV dosyası boş görünüyor.');
  }

  // Normalize headers once
  const headerKeys = headers.map((h) => normalizeHeaderKey(h));

  // Build row objects
  const csvObjects: PatientsCsvRowObj[] = rows.map((cols) => {
    const obj: PatientsCsvRowObj = {};
    headerKeys.forEach((key, idx) => {
      obj[key] = cols[idx] ?? '';
    });
    return obj;
  });

  // Require at least a full_name / ad_soyad column
  const hasFullName =
    headerKeys.includes('full_name') || headerKeys.includes('ad_soyad');

  if (!hasFullName) {
    throw new Error(
      'CSV başlık satırında en az "full_name" (veya "ad_soyad") kolonu bulunmalıdır.',
    );
  }

  const totalRows = csvObjects.length;
  let importedCount = 0;
  const rowErrors: PatientsImportRowError[] = [];

  // Sequential import: easier to reason about + verilen hacim için yeterli.
  for (let idx = 0; idx < csvObjects.length; idx++) {
    const rowIndex = idx + 2; // 1 = header, o yüzden 2'den başlatıyoruz
    const row = csvObjects[idx];

    // CSV → NewPatientForm
    const { formValues, error } = mapCsvRowToNewPatientForm({
      row,
      rowIndex,
    });

    if (!formValues || error) {
      rowErrors.push({
        rowIndex,
        message: error ?? 'Bilinmeyen satır hatası.',
      });
      continue;
    }

    try {
      // Existing flow; this will apply all validations + Supabase insert.
      // Import ile gelen hastalar, varsayılan olarak "faturası kesildi" kabul edilir.
      await createPatient(formValues as NewPatientForm, {
        setInvoiceIssuedTrue: true,
      });
      importedCount += 1;
    } catch (e) {
      const message =
        (e as Error)?.message || 'createPatient sırasında hata oluştu.';
      rowErrors.push({
        rowIndex,
        message,
      });
    }
  }

  const errorCount = rowErrors.length;

  return {
    totalRows,
    importedCount,
    errorCount,
    rowErrors,
  };
}

/**
 * React Query mutation wrapper for Patients CSV import.
 *
 * Usage example (UI tarafında):
 *
 *   const importMutation = usePatientsCsvImportMutation();
 *   importMutation.mutate(file, {
 *     onSuccess: (summary) => { ... },
 *   });
 */
export function usePatientsCsvImportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importPatientsFromCsv,
    onSuccess: () => {
      // Import sonrası hasta listesini tazeleyelim
      void queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
    },
  });
}
