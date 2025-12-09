// src/features/inventory/inventoryImportUtils.ts
// Pure helpers for Inventory CSV import: row normalization, validation and
// payload building for import_jobs + inventory_items pipelines.
//
// This module is intentionally "pure":
// - No Supabase calls
// - No React Query
// So that it is easy to unit test and reuse in other contexts.

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
  raw_purchase_date: string | null;
  raw_notes: string | null;
  valid: boolean;
  /**
   * If valid = false  → blocking error message (row skipped).
   * If valid = true   → optional warning message(s) (row imported, ama uyarı var).
   */
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
 *
 * Supported (case-insensitive):
 * - "hearing_aid", "cihaz"   → "hearing_aid"
 * - "charger", "aksesuar", "sarg", "şarj" → "charger"
 *
 * IMPORTANT:
 * - Bu fonksiyon hata fırlatabilir; çağıran yer try/catch ile sarmalayıp
 *   warning olarak ele alır ve varsayılan "hearing_aid"e düşer.
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
 *
 * Supported (case-insensitive):
 * - empty / "stok" / "stock" / "in_stock"        → "in_stock"
 * - "sold" / "satildi" / "satıldı"               → "sold"
 * - "repair" / "tamirde"                         → "repair"
 *
 * IMPORTANT:
 * - Bu fonksiyon hata fırlatabilir; çağıran yer try/catch ile sarmalayıp
 *   warning olarak ele alır ve varsayılan "in_stock"a düşer.
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
 *
 * Notlar:
 * - 'ÇİFT' / 'cift' / 'both' → 'bilateral'
 * - 'TEK' → null (hangi kulak olduğu belli değil; sonradan düzeltilebilir)
 *
 * IMPORTANT:
 * - Bu fonksiyon hata fırlatabilir; çağıran yer try/catch ile sarmalayıp
 *   warning olarak ele alır ve ear_side = null yapar.
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
 * purchase_date için basit format doğrulaması.
 *
 * Desteklenen formatlar:
 * - dd.MM.yyyy (ör: 9.12.2024, 09.12.2024)
 * - yyyy-MM-dd (ör: 2024-12-09)
 *
 * Dönüş:
 * - true  → format makul (tarih gerçek bir gün/ay kombinasyonu)
 * - false → format geçersiz (warning yazılmalı, tarih yok sayılmalı)
 */
function isParsablePurchaseDate(raw: string): boolean {
  const v = raw.trim();
  if (!v) return true;

  let day: number;
  let month: number;
  let year: number;

  let m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    day = Number(m[1]);
    month = Number(m[2]);
    year = Number(m[3]);
  } else {
    m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return false;
    year = Number(m[1]);
    month = Number(m[2]);
    day = Number(m[3]);
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return false;
  }

  return true;
}

/**
 * Build payloads and counters for inventory import, given CSV objects.
 * No Supabase calls here; this stays pure so it can be reused/tested.
 *
 * Desteklenen başlıklar (normalize edilmiş halleri):
 * - brand / device_brand          → marka (zorunlu)
 * - model / device_model          → model (zorunlu)
 * - item_type                     → "hearing_aid" | "charger" (opsiyonel, boş ise hearing_aid)
 * - barcode                       → barkod (opsiyonel)
 * - serial_no                     → seri numarası (opsiyonel; boşsa warning)
 * - ear_side                      → right/left/bilateral/tek/çift (opsiyonel; hatalıysa warning, null)
 * - status                        → in_stock/sold/repair (opsiyonel, boş ise in_stock; hatalıysa warning)
 * - purchase_price                → alış fiyatı (opsiyonel; parse edilemezse warning, null)
 * - list_price / device_price     → liste fiyatı (opsiyonel; parse edilemezse warning, null)
 * - purchase_date                 → dd.MM.yyyy veya yyyy-MM-dd (opsiyonel; hatalıysa warning)
 * - notes                         → serbest metin (opsiyonel)
 * - patient_national_id           → legacy hasta TC (opsiyonel; notlara
 *                                   "legacy_patient_national_id=..." olarak eklenir)
 *
 * Kurallar:
 * - Blocking error (valid = false, row import edilmez):
 *   * brand (veya device_brand) eksik
 *   * model (veya device_model) eksik
 *
 * - Diğer tüm parsing sorunları:
 *   * Satır valid kalır (valid = true),
 *   * Uyarı metni validation_error içine yazılır.
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
    const rawBrand = (row['brand'] ?? row['device_brand'] ?? '').trim();
    const rawModel = (row['model'] ?? row['device_model'] ?? '').trim();

    const rawItemType = (row['item_type'] ?? '').trim();
    const rawBarcode = (row['barcode'] ?? '').trim();
    const rawSerialNo = (row['serial_no'] ?? '').trim();
    const rawEarSide = (row['ear_side'] ?? '').trim();
    const rawStatus = (row['status'] ?? '').trim();

    const rawPurchasePrice = (row['purchase_price'] ?? '').trim();
    const rawListPrice =
      (row['list_price'] ?? '').trim() ||
      (row['device_price'] ?? '').trim();

    const rawPurchaseDate = (row['purchase_date'] ?? '').trim();

    const rawNotes = (row['notes'] ?? '').trim();
    const rawPatientNationalId = (row['patient_national_id'] ?? '').trim();

    let valid = true;
    let blockingError: string | null = null;
    const warnings: string[] = [];

    // 1) Marka / model zorunlu
    if (!rawBrand) {
      valid = false;
      blockingError =
        'Marka (brand / device_brand) alanı boş olamaz.';
    } else if (!rawModel) {
      valid = false;
      blockingError =
        'Model (model / device_model) alanı boş olamaz.';
    }

    let itemType: InventoryItemType = 'hearing_aid';
    let status: InventoryStatus = 'in_stock';
    let earSideDb: InventoryItemRow['ear_side'] = null;
    let purchasePrice: number | null = null;
    let listPrice: number | null = null;

    // 2) item_type → sadece warning, default hearing_aid
    if (valid) {
      try {
        itemType = normalizeItemType(rawItemType);
      } catch (e) {
        itemType = 'hearing_aid';
        warnings.push((e as Error).message);
      }
    }

    // 3) status → sadece warning, default in_stock
    if (valid) {
      if (rawStatus) {
        try {
          status = normalizeStatus(rawStatus);
        } catch (e) {
          status = 'in_stock';
          warnings.push((e as Error).message);
        }
      } else {
        status = 'in_stock';
      }
    }

    // 4) ear_side → hatalıysa warning, ear_side = null
    if (valid && rawEarSide) {
      try {
        earSideDb = normalizeEarSide(rawEarSide);
      } catch (e) {
        earSideDb = null;
        warnings.push((e as Error).message);
      }
    }

    // 5) purchase_price → parse edilemezse warning, null
    if (valid && rawPurchasePrice) {
      try {
        purchasePrice = parsePriceOrNull(rawPurchasePrice);
      } catch (e) {
        purchasePrice = null;
        warnings.push(
          `purchase_price parse edilemedi, null olarak ayarlandı: ${(e as Error).message}`,
        );
      }
    }

    // 6) list_price → parse edilemezse warning, null
    if (valid && rawListPrice) {
      try {
        listPrice = parsePriceOrNull(rawListPrice);
      } catch (e) {
        listPrice = null;
        warnings.push(
          `list_price / device_price parse edilemedi, null olarak ayarlandı: ${(e as Error).message}`,
        );
      }
    }

    // 7) purchase_date → yalnızca format kontrolü, hatalıysa warning
    if (valid && rawPurchaseDate) {
      if (!isParsablePurchaseDate(rawPurchaseDate)) {
        warnings.push(
          'purchase_date formatı geçersiz, tarih yok sayıldı (beklenen: dd.MM.yyyy veya yyyy-MM-dd).',
        );
      }
    }

    // 8) serial_no boşsa warning
    if (valid && !rawSerialNo) {
      warnings.push('serial_no alanı boş (seri numarası girilmedi).');
    }

    // Staging row yaz
    const validation_error =
      !valid
        ? blockingError
        : warnings.length > 0
          ? warnings.join(' | ')
          : null;

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
      raw_purchase_date: rawPurchaseDate || null,
      raw_notes:
        rawNotes ||
        (rawPatientNationalId
          ? `legacy_patient_national_id=${rawPatientNationalId}`
          : null),
      valid,
      validation_error,
    });

    if (valid) {
      importedCount += 1;

      // Ear side is not strictly required for import; set when present.
      const ear_side =
        itemType === 'charger' ? null : earSideDb;

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
        // NOTE: sold_at is intentionally not imported for now.
        sold_at: null,
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
