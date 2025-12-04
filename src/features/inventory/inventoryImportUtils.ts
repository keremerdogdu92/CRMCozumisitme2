// src/features/inventory/inventoryImportUtils.ts
// Pure helpers for Inventory CSV import: row normalization, validation and
// payload building for import_jobs + inventory_items pipelines.

import type {
  InventoryItemRow,
  InventoryItemType,
  InventoryStatus,
} from './types';
import { parsePriceOrNull } from './inventoryPriceUtils';

export type CsvRowObj = {
  [key: string]: string;
};

export type ImportRowPayload = {
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

export type InventoryImportBuildResult = {
  importRowsPayload: ImportRowPayload[];
  inventoryItemsPayload: any[];
  totalRows: number;
  importedCount: number;
  errorCount: number;
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
  if (!v || v === 'stok' || v === 'stock' || v === 'in_stock')
    return 'in_stock';
  if (v === 'sold' || v === 'satildi' || v === 'satıldı') return 'sold';
  if (v === 'repair' || v === 'tamirde') return 'repair';
  throw new Error(
    'status değeri "in_stock", "sold" veya "repair" olmalıdır.',
  );
}

/**
 * Normalize ear_side from CSV.
 * Returns 'right' | 'left' | 'bilateral' | null.
 *
 * Notlar:
 * - 'ÇİFT' / 'cift' → 'bilateral'
 * - 'TEK' → null (hangi kulak olduğu belli değil; sonradan düzeltilebilir)
 */
function normalizeEarSide(raw: string): InventoryItemRow['ear_side'] {
  const v = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (!v) return null;
  if (v === 'right' || v === 'sag' || v === 'sağ') return 'right';
  if (v === 'left' || v === 'sol') return 'left';
  if (v === 'bilateral' || v === 'cift' || v === 'çift' || v === 'both') {
    return 'bilateral';
  }
  if (v === 'tek') {
    // Single ear ama sağ/sol belli değil → şimdilik null
    return null;
  }
  throw new Error(
    'ear_side değeri "right", "left" veya "bilateral" (veya karşılığı Türkçe) olmalıdır.',
  );
}

/**
 * Build payloads and counters for inventory import, given CSV objects.
 * No Supabase calls here; this stays pure so it can be reused/tested.
 *
 * Desteklenen başlıklar (normalize edilmis halleri):
 * - brand / device_brand
 * - model / device_model
 * - item_type
 * - barcode
 * - serial_no
 * - ear_side
 * - status
 * - purchase_price
 * - list_price / device_price
 * - notes
 * - sold_at (opsiyonel – doluysa status varsayılan olarak "sold")
 * - patient_national_id (şu an sadece ileride kullanmak için okunuyor)
 */
export function buildInventoryImportPayload(args: {
  orgId: string;
  jobId: string;
  csvObjects: CsvRowObj[];
}): InventoryImportBuildResult {
  const { orgId, jobId, csvObjects } = args;

  const totalRows = csvObjects.length;
  let importedCount = 0;
  let errorCount = 0;

  const importRowsPayload: ImportRowPayload[] = [];
  const inventoryItemsPayload: any[] = [];

  csvObjects.forEach((row, idx) => {
    const rowIndex = idx + 2; // 1 = header, so rows start at 2

    // Eski format: brand / model
    // Yeni format: device_brand / device_model
    const rawBrand =
      (row['brand'] ?? row['device_brand'] ?? '').trim();
    const rawModel =
      (row['model'] ?? row['device_model'] ?? '').trim();

    const rawItemType = (row['item_type'] ?? '').trim();
    const rawBarcode = (row['barcode'] ?? '').trim();
    const rawSerialNo = (row['serial_no'] ?? '').trim();
    const rawEarSide = (row['ear_side'] ?? '').trim();
    const rawStatus = (row['status'] ?? '').trim();

    const rawPurchasePrice = (row['purchase_price'] ?? '').trim();
    const rawListPrice =
      (row['list_price'] ?? '').trim() ||
      (row['device_price'] ?? '').trim();

    const rawNotes = (row['notes'] ?? '').trim();

    const rawSoldAt = (row['sold_at'] ?? '').trim();
    const rawPatientNationalId = (row['patient_national_id'] ?? '').trim();

    let valid = true;
    let validationError: string | null = null;

    if (!rawBrand) {
      valid = false;
      validationError = 'Marka (brand / device_brand) alanı boş olamaz.';
    } else if (!rawModel) {
      valid = false;
      validationError = 'Model (model / device_model) alanı boş olamaz.';
    }

    let itemType: InventoryItemType = 'hearing_aid';
    let status: InventoryStatus = 'in_stock';
    let earSideDb: InventoryItemRow['ear_side'] = null;
    let purchasePrice: number | null = null;
    let listPrice: number | null = null;
    let soldAt: string | null = null;

    if (valid) {
      try {
        itemType = normalizeItemType(rawItemType);
      } catch (e) {
        valid = false;
        validationError = (e as Error).message;
      }
    }

    // Status: varsa normalize et, yoksa sold_at'a göre varsayılan belirle
    if (valid) {
      if (rawStatus) {
        try {
          status = normalizeStatus(rawStatus);
        } catch (e) {
          valid = false;
          validationError = (e as Error).message;
        }
      } else if (rawSoldAt) {
        status = 'sold';
      } else {
        status = 'in_stock';
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

    if (valid && rawSoldAt) {
      const d = new Date(rawSoldAt);
      if (Number.isNaN(d.getTime())) {
        valid = false;
        validationError =
          'sold_at geçerli bir tarih olmalıdır (YYYY-AA-GG).';
      } else {
        soldAt = d.toISOString();
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
      raw_status: rawStatus || (rawSoldAt ? 'sold' : null),
      raw_purchase_price: rawPurchasePrice || null,
      raw_list_price: rawListPrice || null,
      raw_notes:
        rawNotes ||
        (rawPatientNationalId
          ? `legacy_patient_national_id=${rawPatientNationalId}`
          : null),
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
        sold_at: soldAt,
      });
    } else {
      errorCount += 1;
    }
  });

  return {
    importRowsPayload,
    inventoryItemsPayload,
    totalRows,
    importedCount,
    errorCount,
  };
}
