// src/features/inventory/api.import.ts
// CSV import pipeline for Inventory + React Query mutation wrapper.
//
// Supabase erişimi, import_jobs yaşam döngüsü ve React Query entegrasyonu
// bu dosyada kalır. Satır bazlı doğrulama ve payload inşası
// inventoryImportUtils.ts içinde tutulur.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import { parseSimpleCsv } from '../../utils/csvUtils';
import type { InventoryImportSummary } from './types';
import { INVENTORY_QUERY_KEY } from './api.keys';
import {
  buildInventoryImportPayload,
  type CsvRowObj,
} from './inventoryImportUtils';

/**
 * Header normalizasyonu:
 * - Küçük harfe çevirir.
 * - Boşlukları '_' ile değiştirir.
 */
function normalizeHeaderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * CSV'den gelen tarihleri ISO string'e çevirir.
 * Desteklenen formatlar:
 * - yyyy-MM-dd  (ör: 2024-11-20)
 * - dd.MM.yyyy  (ör: 20.11.2024)
 * Diğer durumlarda new Date(...) dener; geçersizse null döner.
 */
function parseSoldAtToIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;

  // yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(v + 'T00:00:00Z');
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // dd.MM.yyyy
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(v)) {
    const [ddStr, mmStr, yyyyStr] = v.split('.');
    const dd = Number(ddStr);
    const mm = Number(mmStr);
    const yyyy = Number(yyyyStr);
    if (
      !Number.isFinite(dd) ||
      !Number.isFinite(mm) ||
      !Number.isFinite(yyyy)
    ) {
      return null;
    }
    const d = new Date(Date.UTC(yyyy, mm - 1, dd));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // Fallback: native Date parse
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Import inventory from a CSV file.
 * - Creates an import_jobs row.
 * - Stores every CSV row in inventory_import_rows with validation info.
 * - Inserts valid rows into inventory_items.
 *
 * Ek destek:
 * - patient_national_id kolonu varsa, hastayı patients.national_id üzerinden
 *   bulmaya çalışır ve eşleşirse:
 *     status = 'sold'
 *     sold_patient_id = patient.id
 *     sold_at = CSV'deki sold_at değeri
 */
export async function importInventoryFromCsv(
  file: File,
): Promise<InventoryImportSummary> {
  const text = await file.text();
  const { headers, rows } = parseSimpleCsv(text);

  if (headers.length === 0 || rows.length === 0) {
    throw new Error('CSV dosyası boş görünüyor.');
  }

  // Build row objects with header → value mapping
  // - Header'ları normalize ediyoruz (küçük harf + '_' boşluk yerine).
  const normalizedHeaders = headers.map((h) => normalizeHeaderKey(h));

  // Örnek alias desteği:
  // device_brand → brand
  // device_model → model
  const canonicalHeaders = normalizedHeaders.map((key) => {
    if (key === 'device_brand' || key === 'marka') return 'brand';
    if (key === 'device_model' || key === 'modeli') return 'model';
    if (key === 'fiyat') return 'device_price';
    return key;
  });

  const csvObjects: CsvRowObj[] = rows.map((cols) => {
    const obj: CsvRowObj = {};
    canonicalHeaders.forEach((key, idx) => {
      obj[key] = cols[idx] ?? '';
    });
    return obj;
  });

  // Require at least brand + model columns (alias'lar dahil).
  const hasBrand =
    canonicalHeaders.includes('brand') ||
    canonicalHeaders.includes('device_brand');
  const hasModel =
    canonicalHeaders.includes('model') ||
    canonicalHeaders.includes('device_model');

  if (!hasBrand || !hasModel) {
    throw new Error(
      'CSV başlık satırında en az "brand" (veya "device_brand") ve "model" (veya "device_model") kolonları bulunmalıdır.',
    );
  }

  // Current user & org
  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();
  if (userError) {
    console.error('Failed to get current user for inventory import:', userError);
    throw new Error('IMPORT_USER: ' + userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('IMPORT_USER: Kullanıcı oturumu bulunamadı.');
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id, org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Failed to load profile for inventory import:', profileError);
    throw new Error('IMPORT_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    throw new Error('IMPORT_NO_ORG: Profilde org_id bulunamadı.');
  }

  const orgId: string = profile.org_id as string;
  const createdBy: string = profile.id as string;

  // 1) Create import_jobs row (status = processing)
  const { data: jobData, error: jobError } = await supabaseClient
    .from('import_jobs')
    .insert({
      org_id: orgId,
      target_entity: 'inventory',
      status: 'processing',
      source_filename: file.name,
      row_count: csvObjects.length,
      error_count: 0,
      created_by: createdBy,
    })
    .select('id')
    .single();

  if (jobError || !jobData?.id) {
    console.error('Failed to create import_jobs row:', jobError);
    throw new Error('IMPORT_JOB: ' + (jobError?.message ?? 'job oluşturulamadı.'));
  }

  const jobId: string = jobData.id as string;

  // 2) Build per-row payloads and counters using shared utility.
  // inventoryItemsPayload artık şu formda draft döner:
  // { rowIndex, item, patientNationalId, soldAtRaw }
  const {
    importRowsPayload,
    inventoryItemsPayload,
    totalRows,
    importedCount,
    errorCount,
  } = buildInventoryImportPayload({
    orgId,
    jobId,
    csvObjects,
  });

  try {
    // 3) inventory_import_rows insert
    if (importRowsPayload.length > 0) {
      const { error: rowsError } = await supabaseClient
        .from('inventory_import_rows')
        .insert(importRowsPayload);

      if (rowsError) {
        console.error('Failed to insert inventory_import_rows:', rowsError);
        throw new Error('IMPORT_ROWS: ' + rowsError.message);
      }
    }

    // 4) valid rows → inventory_items insert
    let itemsToInsert: any[] = [];

    if (inventoryItemsPayload.length > 0) {
      // Önce hasta TC'leri ile hastaları tek sorguda çekelim.
      const nationalIds = Array.from(
        new Set(
          inventoryItemsPayload
            .map(
              (draft: any) =>
                (draft.patientNationalId as string | null | undefined) ?? null,
            )
            .filter((v): v is string => !!v && v.trim().length > 0),
        ),
      );

      let patientMap = new Map<string, string>();

      if (nationalIds.length > 0) {
        const { data: patients, error: patientsError } = await supabaseClient
          .from('patients')
          .select('id, national_id')
          .eq('org_id', orgId)
          .in('national_id', nationalIds);

        if (patientsError) {
          console.error(
            'IMPORT_PATIENT_LOOKUP: Failed to fetch patients for device import:',
            patientsError,
          );
        } else if (patients && patients.length > 0) {
          for (const p of patients as any[]) {
            if (p.national_id && p.id) {
              patientMap.set(String(p.national_id), String(p.id));
            }
          }
        }
      }

      itemsToInsert = inventoryItemsPayload.map((draft: any) => {
        const baseItem = { ...(draft.item as any) };

        const patientNationalId: string | null =
          (draft.patientNationalId as string | null | undefined) ?? null;
        const soldAtRaw: string | null =
          (draft.soldAtRaw as string | null | undefined) ?? null;

        if (patientNationalId) {
          const patientId = patientMap.get(patientNationalId);
          if (patientId) {
            baseItem.sold_patient_id = patientId;
            baseItem.status = 'sold';

            const soldAtIso = parseSoldAtToIso(soldAtRaw);
            if (soldAtIso) {
              baseItem.sold_at = soldAtIso;
            }
          }
        }

        return baseItem;
      });

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabaseClient
          .from('inventory_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error('Failed to insert inventory_items from import:', itemsError);
          throw new Error('IMPORT_ITEMS: ' + itemsError.message);
        }
      }
    }

    // 5) job update → completed
    const { error: updateError } = await supabaseClient
      .from('import_jobs')
      .update({
        status: 'completed',
        row_count: totalRows,
        error_count: errorCount,
        finished_at: new Date().toISOString(),
        error_message:
          errorCount > 0
            ? 'Bazı satırlar hatalı; detay için inventory_import_rows tablosuna bakın.'
            : null,
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to update import_jobs after completion:', updateError);
      // Import is already done; do not rethrow here.
    }
  } catch (err) {
    // Mark job as failed
    await supabaseClient
      .from('import_jobs')
      .update({
        status: 'failed',
        row_count: totalRows,
        error_count: errorCount,
        finished_at: new Date().toISOString(),
        error_message: (err as Error).message,
      })
      .eq('id', jobId);

    throw err;
  }

  return {
    jobId,
    totalRows,
    importedCount,
    errorCount,
  };
}

/**
 * React Query mutation wrapper for CSV import.
 */
export function useInventoryCsvImportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importInventoryFromCsv,
    onSuccess: () => {
      // After import, refresh inventory list
      void queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });
    },
  });
}
