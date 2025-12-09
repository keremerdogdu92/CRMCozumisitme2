// src/features/inventory/deviceCatalog/api.import.ts
// Summary: CSV import pipeline for device catalog pricing
// (device_catalog_models + device_catalog_prices).
//
// Responsibilities:
// - Parse CSV using parseSimpleCsv.
// - Resolve org_id from current profile.
// - For each row:
//   * Normalize/validate fields (brand, model, item_type, prices, valid_from).
//   * Find or create device_catalog_models row for (org_id, brand, model, item_type).
//   * Insert a new device_catalog_prices row with valid_from, purchase_price, list_price.
// - Return a summary with counts (total, success, created/updated models, errors).
//
// Notes:
// - This importer does NOT touch inventory_items.
// - current_device_model_prices_public view will automatically pick the latest
//   price per model based on valid_from.

import { useMutation } from '@tanstack/react-query';
import { supabaseClient } from '../../../utils/supabaseClient';
import { parseSimpleCsv } from '../../../utils/csvUtils';
import type { DeviceCatalogImportSummary } from './types';

// Supabase base tables for the catalog
const DEVICE_CATALOG_MODELS_TABLE = 'device_catalog_models';
const DEVICE_CATALOG_PRICES_TABLE = 'device_catalog_prices';

type CsvRowObj = {
  [key: string]: string;
};

/**
 * Normalize CSV header keys:
 * - Trim whitespace.
 * - Lowercase.
 * - Replace internal spaces with "_".
 *
 * Examples:
 *   "Brand"            → "brand"
 *   "Device Model"     → "device_model"
 *   " Valid From "     → "valid_from"
 */
function normalizeHeaderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Normalize item_type from CSV.
 *
 * Supported (case-insensitive):
 * - "hearing_aid", "cihaz"          → "hearing_aid"
 * - "charger", "aksesuar", "şarj"   → "charger"
 *
 * Any other value is treated as a blocking error.
 */
function normalizeItemType(raw: string): 'hearing_aid' | 'charger' {
  const v = raw.trim().toLowerCase();
  if (!v) {
    throw new Error('item_type alanı boş olamaz (hearing_aid / charger).');
  }
  if (v === 'hearing_aid' || v === 'cihaz') return 'hearing_aid';
  if (v === 'charger' || v === 'aksesuar' || v === 'şarj') return 'charger';
  throw new Error(
    'item_type değeri "hearing_aid" veya "charger" (veya Türkçe karşılığı) olmalıdır.',
  );
}

/**
 * Parse a price string into a number.
 * Accepts formats like "12345", "12.345", "12.345,67", "12345,67".
 *
 * Throws on invalid input.
 */
function parsePriceStrict(raw: string, fieldName: string): number {
  const v = raw.trim();
  if (!v) {
    throw new Error(`${fieldName} alanı boş olamaz.`);
  }

  // Basic normalization for TR-style decimals:
  // - Remove thousands separators '.' if they exist.
  // - Replace ',' with '.' for decimals.
  const normalized = v.replace(/\./g, '').replace(/,/g, '.').trim();

  const n = Number(normalized);
  if (!Number.isFinite(n)) {
    throw new Error(`${fieldName} numerik bir değer olmalıdır: "${raw}"`);
  }
  if (n < 0) {
    throw new Error(`${fieldName} negatif olamaz: "${raw}"`);
  }
  return n;
}

/**
 * Compute an effective valid_from date for the price.
 *
 * Rules:
 * - If CSV valid_from is non-empty, return it as-is (Postgres will parse).
 * - If CSV valid_from is empty, return today's date as "YYYY-MM-DD".
 *
 * This keeps the column nullable in CSV but ensures DB always receives
 * a concrete "from this day" value.
 */
function computeEffectiveValidFrom(raw: string): string {
  const v = raw.trim();
  if (v) {
    return v;
  }
  // Use today's date in YYYY-MM-DD format (local time is fine; Postgres will cast).
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Import device catalog prices from a CSV file.
 *
 * CSV headers (normalized):
 * - brand            (required)
 * - model            (required)
 * - item_type        (required) "hearing_aid" | "charger"
 * - purchase_price   (required)
 * - list_price       (required)
 * - details          (optional)
 * - battery_type     (optional)
 * - valid_from       (optional; if empty, today is used)
 *
 * Behavior:
 * - For each row:
 *   * If (brand/model/item_type) missing → row skipped, counted as error.
 *   * If numeric parsing fails → row skipped, counted as error.
 *   * Otherwise:
 *       1) Find or create device_catalog_models row (by org_id + brand + model + item_type).
 *       2) Insert a new device_catalog_prices row with valid_from, purchase_price, list_price.
 */
export async function importDeviceCatalogFromCsv(
  file: File,
): Promise<DeviceCatalogImportSummary> {
  const text = await file.text();
  const { headers, rows } = parseSimpleCsv(text);

  if (headers.length === 0 || rows.length === 0) {
    throw new Error('CSV dosyası boş görünüyor.');
  }

  const headerKeys = headers.map((h) => normalizeHeaderKey(h));

  const csvObjects: CsvRowObj[] = rows.map((cols) => {
    const obj: CsvRowObj = {};
    headerKeys.forEach((key, idx) => {
      obj[key] = cols[idx] ?? '';
    });
    return obj;
  });

  const hasBrand = headerKeys.includes('brand');
  const hasModel = headerKeys.includes('model');
  const hasItemType = headerKeys.includes('item_type');
  const hasPurchasePrice = headerKeys.includes('purchase_price');
  const hasListPrice = headerKeys.includes('list_price');

  if (!hasBrand || !hasModel || !hasItemType || !hasPurchasePrice || !hasListPrice) {
    throw new Error(
      'CSV başlık satırında en az "brand", "model", "item_type", "purchase_price" ve "list_price" kolonları bulunmalıdır.',
    );
  }

  // Current user & org
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) {
    console.error('Device catalog import: getUser error:', userError);
    throw new Error('CATALOG_IMPORT_USER: ' + userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('CATALOG_IMPORT_USER: Kullanıcı oturumu bulunamadı.');
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id, org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Device catalog import: profile error:', profileError);
    throw new Error('CATALOG_IMPORT_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    throw new Error('CATALOG_IMPORT_NO_ORG: Profilde org_id bulunamadı.');
  }

  const orgId: string = profile.org_id as string;

  const totalRows = csvObjects.length;
  let successCount = 0;
  let errorCount = 0;
  let createdModelCount = 0;
  let updatedModelCount = 0;

  // Sequential processing to keep logs and errors easy to track.
  for (let idx = 0; idx < csvObjects.length; idx += 1) {
    const rowIndex = idx + 2; // 1 = header, so rows start at 2
    const row = csvObjects[idx];

    const rawBrand = (row['brand'] ?? '').trim();
    const rawModel = (row['model'] ?? '').trim();
    const rawItemType = (row['item_type'] ?? '').trim();
    const rawPurchasePrice = (row['purchase_price'] ?? '').trim();
    const rawListPrice = (row['list_price'] ?? '').trim();
    const rawDetails = (row['details'] ?? '').trim();
    const rawBatteryType = (row['battery_type'] ?? '').trim();
    const rawValidFrom = (row['valid_from'] ?? '').trim();

    try {
      if (!rawBrand) {
        throw new Error('brand alanı boş olamaz.');
      }
      if (!rawModel) {
        throw new Error('model alanı boş olamaz.');
      }
      const itemType = normalizeItemType(rawItemType);
      const purchasePrice = parsePriceStrict(rawPurchasePrice, 'purchase_price');
      const listPrice = parsePriceStrict(rawListPrice, 'list_price');
      const effectiveValidFrom = computeEffectiveValidFrom(rawValidFrom);

      // 1) Find or create model
      const { data: existingModels, error: findError } = await supabaseClient
        .from(DEVICE_CATALOG_MODELS_TABLE)
        .select('id')
        .eq('org_id', orgId)
        .eq('brand', rawBrand)
        .eq('model', rawModel)
        .eq('item_type', itemType)
        .limit(1);

      if (findError) {
        throw new Error(
          `device_catalog_models sorgu hatası (satır ${rowIndex}): ${findError.message}`,
        );
      }

      let modelId: string;
      let isNewModel = false;

      if (existingModels && existingModels.length > 0) {
        // Model already exists → just reuse id.
        modelId = (existingModels[0] as any).id as string;
        updatedModelCount += 1;
      } else {
        // Create new model
        const { data: insertModelData, error: insertModelError } = await supabaseClient
          .from(DEVICE_CATALOG_MODELS_TABLE)
          .insert({
            org_id: orgId,
            brand: rawBrand,
            model: rawModel,
            item_type: itemType,
            details: rawDetails || null,
            battery_type: rawBatteryType || null,
            is_active: true,
          })
          .select('id')
          .single();

        if (insertModelError || !insertModelData) {
          throw new Error(
            `device_catalog_models insert hatası (satır ${rowIndex}): ${
              insertModelError?.message ?? 'model oluşturulamadı'
            }`,
          );
        }

        modelId = insertModelData.id as string;
        isNewModel = true;
        createdModelCount += 1;
      }

      // 2) Insert price row
      const { error: priceInsertError } = await supabaseClient
        .from(DEVICE_CATALOG_PRICES_TABLE)
        .insert({
          model_id: modelId,
          valid_from: effectiveValidFrom,
          purchase_price: purchasePrice,
          list_price: listPrice,
        });

      if (priceInsertError) {
        throw new Error(
          `device_catalog_prices insert hatası (satır ${rowIndex}): ${priceInsertError.message}`,
        );
      }

      successCount += 1;

      // Optional: log minimal info in devtools
      console.debug?.('[DeviceCatalogImport] Row OK', {
        rowIndex,
        brand: rawBrand,
        model: rawModel,
        itemType,
        isNewModel,
      });
    } catch (e) {
      errorCount += 1;
      console.error(
        '[DeviceCatalogImport] Row FAILED',
        {
          rowIndex,
          brand: rawBrand,
          model: rawModel,
          itemType: rawItemType,
        },
        e,
      );
      // Continue with next row; we do not abort the whole import.
    }
  }

  return {
    totalRows,
    successCount,
    createdModelCount,
    updatedModelCount,
    errorCount,
  };
}

/**
 * React Query mutation wrapper for device catalog CSV import.
 *
 * Can be used in a UI card component similar to InventoryImportCard.
 */
export function useDeviceCatalogImportMutation() {
  return useMutation({
    mutationFn: importDeviceCatalogFromCsv,
  });
}
