// src/features/inventory/api.import.ts
// CSV import pipeline for Inventory + React Query mutation wrapper.
//
// Supabase erişimi, import_jobs yaşam döngüsü ve React Query entegrasyonu
// bu dosyada kalır. Satır bazlı doğrulama ve payload inşası
// inventoryImportUtils.ts içinde tutulur.
//
// v2.0:
// - CSV satırlarında purchase_price + list_price tamamen boş ise,
//   current_device_model_prices_public view'undan katalog fiyatlarını
//   çekip doldurur.
// - Eğer katalogta da bulunamazsa, satır blocking error olarak işaretlenir
//   (import edilmeyen satır).

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import { parseSimpleCsv } from '../../utils/csvUtils';
import type { InventoryImportSummary, InventoryItemType } from './types';
import { INVENTORY_QUERY_KEY } from './api.keys';
import {
  buildInventoryImportPayload,
  type CsvRowObj,
  type BarcodeCatalogKeyMap,
  type CatalogPriceMap,
  makeCatalogPriceKey,
  makeCatalogPriceLookupKeys,
  normalizeBarcodeForLookup,
  normalizeItemType,
} from './inventoryImportUtils';

type CatalogPriceRow = {
  brand: string | null;
  model: string | null;
  item_type: InventoryItemType | null;
  list_price: unknown;
  purchase_price: unknown;
};

type InventoryBarcodeLookupRow = {
  barcode: string | null;
  brand: string | null;
  model: string | null;
  item_type: InventoryItemType | null;
};

/**
 * Basit header normalizasyonu:
 * - Baştaki/sondaki boşlukları kırp
 * - Küçük harfe çevir
 * - Birden fazla boşluğu '_' yap
 *
 * Örnek:
 *   "Device Brand"  → "device_brand"
 *   "brand"         → "brand"
 */
function normalizeHeaderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Import inventory from a CSV file.
 * - Creates an import_jobs row.
 * - Stores every CSV row in inventory_import_rows with validation info.
 * - Inserts valid rows into inventory_items.
 * - Boş fiyatlar için (purchase_price + list_price):
 *   * current_device_model_prices_public üzerinden katalogtan doldurmayı dener.
 *   * Katalogta yoksa satırı blocking error yapar (util içinde).
 */
export async function importInventoryFromCsv(
  file: File,
): Promise<InventoryImportSummary> {
  const text = await file.text();
  const { headers, rows } = parseSimpleCsv(text);

  if (headers.length === 0 || rows.length === 0) {
    throw new Error('CSV dosyası boş görünüyor.');
  }

  // Build row objects with normalized header → value mapping
  const headerKeys = headers.map((h) => normalizeHeaderKey(h));

  const csvObjects: CsvRowObj[] = rows.map((cols) => {
    const obj: CsvRowObj = {};
    headerKeys.forEach((key, idx) => {
      obj[key] = cols[idx] ?? '';
    });
    return obj;
  });

  // Require at least brand + model columns.
  // Eski format:  brand, model
  // Yeni format:  device_brand, device_model
  const hasBrand =
    headerKeys.includes('brand') || headerKeys.includes('device_brand');
  const hasModel =
    headerKeys.includes('model') || headerKeys.includes('device_model');

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
    throw new Error(
      'IMPORT_JOB: ' + (jobError?.message ?? 'job oluşturulamadı.'),
    );
  }

  const jobId: string = jobData.id as string;

  // 2) Katalog fiyat haritasını hazırla (yalnızca her iki fiyat da boş olan satırlar için)
  const catalogPriceMap: CatalogPriceMap = {};
  const barcodeCatalogKeyMap: BarcodeCatalogKeyMap = {};

  const combosNeedingCatalog = new Set<string>();
  const itemTypesForFilter = new Set<InventoryItemType>();
  const barcodesForLookup = new Set<string>();

  csvObjects.forEach((row) => {
    const rawBrand = (row['brand'] ?? row['device_brand'] ?? '').trim();
    const rawModel = (row['model'] ?? row['device_model'] ?? '').trim();
    const rawItemType = (row['item_type'] ?? '').trim();
    const hasPurchase = (row['purchase_price'] ?? '').trim().length > 0;
    const hasList =
      (row['list_price'] ?? '').trim().length > 0 ||
      (row['device_price'] ?? '').trim().length > 0;

    // Marka/model/item_type yoksa veya zaten fiyat girilmişse → katalog lookup yok
    if (!rawBrand || !rawModel || !rawItemType) return;
    if (hasPurchase || hasList) return;

    try {
      const itemType = normalizeItemType(rawItemType);
      const key = makeCatalogPriceKey(rawBrand, rawModel, itemType);
      if (!combosNeedingCatalog.has(key)) {
        combosNeedingCatalog.add(key);
        itemTypesForFilter.add(itemType);
      }
      const barcode = normalizeBarcodeForLookup(row['barcode'] ?? '');
      if (barcode) {
        barcodesForLookup.add(barcode);
      }
    } catch {
      // Geçersiz item_type; blocking error olarak daha sonra util içinde ele alınacak.
    }
  });

  if (combosNeedingCatalog.size > 0) {
    const toNumberOrNull = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const num = Number(v);
      if (!Number.isFinite(num)) return null;
      return Number(num.toFixed(2));
    };

    let query = supabaseClient
      .from('current_device_model_prices_public')
      .select('brand, model, item_type, list_price, purchase_price')
      .eq('org_id', orgId);

    const itemTypeList = Array.from(itemTypesForFilter);

    if (itemTypeList.length === 1) {
      query = query.eq('item_type', itemTypeList[0]);
    } else {
      query = query.in('item_type', itemTypeList);
    }

    const { data: catalogRows, error: catalogError } = await query;

    if (catalogError) {
      console.error(
        'Failed to load catalog prices for inventory import:',
        catalogError,
      );
      throw new Error('IMPORT_CATALOG: ' + catalogError.message);
    }

    for (const row of (catalogRows ?? []) as CatalogPriceRow[]) {
      const brand = row.brand;
      const model = row.model;
      const itemType = row.item_type;

      if (!brand || !model || !itemType) continue;

      const key = makeCatalogPriceKey(brand, model, itemType);
      catalogPriceMap[key] = {
        purchase_price: toNumberOrNull(row.purchase_price),
        list_price: toNumberOrNull(row.list_price),
      };
    }

    const barcodeList = Array.from(barcodesForLookup);
    if (barcodeList.length > 0) {
      const { data: inventoryRows, error: inventoryError } = await supabaseClient
        .from('inventory_items')
        .select('barcode, brand, model, item_type')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .in('barcode', barcodeList);

      if (inventoryError) {
        console.error(
          'Failed to load barcode model matches for inventory import:',
          inventoryError,
        );
        throw new Error('IMPORT_BARCODE_LOOKUP: ' + inventoryError.message);
      }

      const candidatesByBarcode = new Map<string, Set<string>>();

      for (const row of (inventoryRows ?? []) as InventoryBarcodeLookupRow[]) {
        const barcode = normalizeBarcodeForLookup(row.barcode ?? '');
        const brand = row.brand;
        const model = row.model;
        const itemType = row.item_type;

        if (!barcode || !brand || !model || !itemType) continue;

        const matchingKey = makeCatalogPriceLookupKeys(
          brand,
          model,
          itemType,
        ).find((key) => catalogPriceMap[key]);

        if (!matchingKey) continue;

        const keys = candidatesByBarcode.get(barcode) ?? new Set<string>();
        keys.add(matchingKey);
        candidatesByBarcode.set(barcode, keys);
      }

      for (const [barcode, keys] of candidatesByBarcode.entries()) {
        if (keys.size === 1) {
          barcodeCatalogKeyMap[barcode] = Array.from(keys)[0];
        }
      }
    }
  }

  // 3) Build per-row payloads and counters using shared utility
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
    catalogPriceMap,
    barcodeCatalogKeyMap,
  });

  try {
    // 4) inventory_import_rows insert
    if (importRowsPayload.length > 0) {
      const { error: rowsError } = await supabaseClient
        .from('inventory_import_rows')
        .insert(importRowsPayload);

      if (rowsError) {
        console.error('Failed to insert inventory_import_rows:', rowsError);
        throw new Error('IMPORT_ROWS: ' + rowsError.message);
      }
    }

    // 5) valid rows → inventory_items insert
    if (inventoryItemsPayload.length > 0) {
      const { error: itemsError } = await supabaseClient
        .from('inventory_items')
        .insert(inventoryItemsPayload);

      if (itemsError) {
        console.error('Failed to insert inventory_items from import:', itemsError);
        throw new Error('IMPORT_ITEMS: ' + itemsError.message);
      }
    }

    // 6) job update → completed
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
