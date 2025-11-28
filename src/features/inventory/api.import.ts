// src/features/inventory/api.import.ts
// CSV import pipeline for Inventory + React Query mutation wrapper.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import { parseSimpleCsv } from '../../utils/csvUtils';
import type {
  InventoryImportSummary,
  InventoryItemRow,
  InventoryItemType,
  InventoryStatus,
} from './types';
import { INVENTORY_QUERY_KEY } from './api.keys';
import { parsePriceOrNull } from './inventoryPriceUtils';

type CsvRowObj = {
  [key: string]: string;
};

/**
 * Normalize item_type from CSV.
 */
function normalizeItemType(raw: string): InventoryItemType {
  const v = raw.trim().toLowerCase();
  if (!v) return 'hearing_aid';
  if (v === 'hearing_aid' || v === 'cihaz') return 'hearing_aid';
  if (v === 'charger' || v === 'aksesuar' || v === 'sarg' || v === 'şarj') {
    return 'charger';
  }
  throw new Error('item_type değeri "hearing_aid" veya "charger" olmalıdır.');
}

/**
 * Normalize status from CSV.
 */
function normalizeStatus(raw: string): InventoryStatus {
  const v = raw.trim().toLowerCase();
  if (!v || v === 'stok' || v === 'stock' || v === 'in_stock') return 'in_stock';
  if (v === 'sold' || v === 'satildi' || v === 'satıldı') return 'sold';
  if (v === 'repair' || v === 'tamirde') return 'repair';
  throw new Error('status değeri "in_stock", "sold" veya "repair" olmalıdır.');
}

/**
 * Normalize ear_side from CSV.
 * Returns 'right' | 'left' | 'bilateral' | null.
 */
function normalizeEarSide(raw: string): InventoryItemRow['ear_side'] {
  const v = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (!v) return null;
  if (v === 'right' || v === 'sag' || v === 'sağ') return 'right';
  if (v === 'left' || v === 'sol') return 'left';
  if (v === 'bilateral' || v === 'cift' || v === 'çift' || v === 'both') {
    return 'bilateral';
  }
  throw new Error(
    'ear_side değeri "right", "left" veya "bilateral" (veya karşılığı Türkçe) olmalıdır.',
  );
}

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

  const totalRows = csvObjects.length;
  let importedCount = 0;
  let errorCount = 0;

  type ImportRowPayload = {
    job_id: string;
    row_index: number;
    raw_brand: string | null;
    raw_model: string | null;
    raw_item_type: string | null;
    raw_barcode: string | null;
    raw_serial_no: string | null;
    raw_ear_side: string | null;
    raw_status: string | null;
    raw_purchase_price: string | null;
    raw_list_price: string | null;
    raw_notes: string | null;
    valid: boolean;
    validation_error: string | null;
  };

  const importRowsPayload: ImportRowPayload[] = [];
  const inventoryItemsPayload: any[] = [];

  // 1) Create import_jobs row (status = processing)
  const { data: jobData, error: jobError } = await supabaseClient
    .from('import_jobs')
    .insert({
      org_id: orgId,
      target_entity: 'inventory',
      status: 'processing',
      source_filename: file.name,
      row_count: totalRows,
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

  // 2) Per-row validation + payload build
  csvObjects.forEach((row, idx) => {
    const rowIndex = idx + 2; // 1 = header, so rows start at 2
    const rawBrand = (row['brand'] ?? '').trim();
    const rawModel = (row['model'] ?? '').trim();
    const rawItemType = (row['item_type'] ?? '').trim();
    const rawBarcode = (row['barcode'] ?? '').trim();
    const rawSerialNo = (row['serial_no'] ?? '').trim();
    const rawEarSide = (row['ear_side'] ?? '').trim();
    const rawStatus = (row['status'] ?? '').trim();
    const rawPurchasePrice = (row['purchase_price'] ?? '').trim();
    const rawListPrice = (row['list_price'] ?? '').trim();
    const rawNotes = (row['notes'] ?? '').trim();

    let valid = true;
    let validationError: string | null = null;

    if (!rawBrand) {
      valid = false;
      validationError = 'Marka (brand) alanı boş olamaz.';
    } else if (!rawModel) {
      valid = false;
      validationError = 'Model (model) alanı boş olamaz.';
    }

    let itemType: InventoryItemType = 'hearing_aid';
    let status: InventoryStatus = 'in_stock';
    let earSideDb: InventoryItemRow['ear_side'] = null;
    let purchasePrice: number | null = null;
    let listPrice: number | null = null;

    if (valid) {
      try {
        itemType = normalizeItemType(rawItemType);
      } catch (e) {
        valid = false;
        validationError = (e as Error).message;
      }
    }

    if (valid) {
      try {
        status = normalizeStatus(rawStatus);
      } catch (e) {
        valid = false;
        validationError = (e as Error).message;
      }
    }

    if (valid && rawEarSide) {
      try {
        earSideDb = normalizeEarSide(rawEarSide);
      } catch (e) {
        valid = false;
        validationError = (e as Error).message;
      }
    }

    if (valid && rawPurchasePrice) {
      try {
        purchasePrice = parsePriceOrNull(rawPurchasePrice);
      } catch (e) {
        valid = false;
        validationError = (e as Error).message;
      }
    }

    if (valid && rawListPrice) {
      try {
        listPrice = parsePriceOrNull(rawListPrice);
      } catch (e) {
        valid = false;
        validationError = (e as Error).message;
      }
    }

    importRowsPayload.push({
      job_id: jobId,
      row_index: rowIndex,
      raw_brand: rawBrand || null,
      raw_model: rawModel || null,
      raw_item_type: rawItemType || null,
      raw_barcode: rawBarcode || null,
      raw_serial_no: rawSerialNo || null,
      raw_ear_side: rawEarSide || null,
      raw_status: rawStatus || null,
      raw_purchase_price: rawPurchasePrice || null,
      raw_list_price: rawListPrice || null,
      raw_notes: rawNotes || null,
      valid,
      validation_error: validationError,
    });

    if (valid) {
      importedCount += 1;

      // Ear side is not strictly required for import; set when present.
      const ear_side = itemType === 'charger' ? null : earSideDb;

      inventoryItemsPayload.push({
        org_id: orgId,
        brand: rawBrand,
        model: rawModel,
        item_type: itemType,
        barcode: rawBarcode || null,
        serial_no: rawSerialNo || null,
        ear_side,
        status,
        purchase_price: purchasePrice,
        list_price: listPrice,
        sold_patient_id: null,
        sold_at: null,
      });
    } else {
      errorCount += 1;
    }
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
