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
 * Import inventory from a CSV file.
 * - Creates an import_jobs row.
 * - Stores every CSV row in inventory_import_rows with validation info.
 * - Inserts valid rows into inventory_items.
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
  const headerKeys = headers.map((h) => h.replace(/\s+/g, '_'));
  const csvObjects: CsvRowObj[] = rows.map((cols) => {
    const obj: CsvRowObj = {};
    headerKeys.forEach((key, idx) => {
      obj[key] = cols[idx] ?? '';
    });
    return obj;
  });

  // Require at least brand + model columns
  if (!headerKeys.includes('brand') || !headerKeys.includes('model')) {
    throw new Error(
      'CSV başlık satırında en az "brand" ve "model" kolonları bulunmalıdır.',
    );
  }

  // Current user & org
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
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

  // 2) Build per-row payloads and counters using shared utility
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
    if (inventoryItemsPayload.length > 0) {
      const { error: itemsError } = await supabaseClient
        .from('inventory_items')
        .insert(inventoryItemsPayload);

      if (itemsError) {
        console.error('Failed to insert inventory_items from import:', itemsError);
        throw new Error('IMPORT_ITEMS: ' + itemsError.message);
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
