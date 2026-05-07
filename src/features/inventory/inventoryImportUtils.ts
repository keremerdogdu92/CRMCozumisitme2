// src/features/inventory/inventoryImportUtils.ts
// Pure helpers for Inventory CSV import: row normalization, validation and
// payload building for import_jobs + inventory_items pipelines.
//
// This module is intentionally "pure":
// - No Supabase calls
// - No React Query
// So that it is easy to unit test and reuse in other contexts.
//
// v2.0:
// - Adds optional CatalogPriceMap support: if both purchase_price and list_price
//   are empty in CSV, and a catalog entry exists for (brand, model, item_type),
//   prices are filled from catalog.
// - If both prices are empty in CSV AND catalog entry is missing, row becomes
//   blocking error: "fiyat eksik, katalogta da yok".

import type { InventoryItemType, InventoryStatus } from './types';
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
  raw_status: string | null;
  raw_purchase_price: string | null;
  raw_list_price: string | null;
  raw_purchase_date: string | null;
  raw_notes: string | null;
  valid: boolean;
  /**
   * Eğer valid = false ise:
   *   - blocking error mesajı (satır import edilmez).
   * Eğer valid = true ise:
   *   - warning mesaj(lar)ı (satır import edilir ama uyarı var).
   */
  validation_error: string | null;
};

export type InventoryItemImportPayload = {
  org_id: string;
  brand: string;
  model: string;
  item_type: InventoryItemType;
  barcode: string | null;
  serial_no: string | null;
  ear_side: null;
  status: InventoryStatus;
  purchase_price: number | null;
  list_price: number | null;
  sold_patient_id: null;
  sold_at: null;
};

export type InventoryImportBuildResult = {
  importRowsPayload: ImportRowPayload[];
  inventoryItemsPayload: InventoryItemImportPayload[];
  totalRows: number;
  importedCount: number;
  errorCount: number;
};

/**
 * Catalog price lookup tipi:
 * - Anahtar: normalize edilmiş "brand::model::item_type"
 * - Değer: katalogdaki purchase_price/list_price (number | null)
 */
export type CatalogPriceMapEntry = {
  purchase_price: number | null;
  list_price: number | null;
};

export type CatalogPriceMap = Record<string, CatalogPriceMapEntry>;
export type BarcodeCatalogKeyMap = Record<string, string>;

export function normalizeCatalogMatchText(raw: string): string {
  return raw
    .trim()
    .replace(/[İIı]/g, 'i')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeBarcodeForLookup(raw: string): string {
  return raw.trim().replace(/\s+/g, '');
}

function applyCatalogModelAlias(
  brandKey: string,
  modelKey: string,
  itemType: InventoryItemType,
): string {
  if (brandKey === 'rexton' && itemType === 'hearing_aid') {
    if (modelKey.startsWith('b li ')) {
      return `bicore ${modelKey}`;
    }
  }

  return modelKey;
}

/**
 * Tek bir katalog anahtarı üret:
 * - brand/model trim + lowercase
 * - item_type olduğu gibi (zaten normalize edilmiş: "hearing_aid" | "charger")
 */
export function makeCatalogPriceKey(
  brand: string,
  model: string,
  itemType: InventoryItemType,
): string {
  return `${normalizeCatalogMatchText(brand)}::${normalizeCatalogMatchText(
    model,
  )}::${itemType}`;
}

export function makeCatalogPriceLookupKeys(
  brand: string,
  model: string,
  itemType: InventoryItemType,
): string[] {
  const brandKey = normalizeCatalogMatchText(brand);
  const modelKey = normalizeCatalogMatchText(model);
  const directKey = `${brandKey}::${modelKey}::${itemType}`;
  const aliasedModelKey = applyCatalogModelAlias(brandKey, modelKey, itemType);
  const aliasedKey = `${brandKey}::${aliasedModelKey}::${itemType}`;

  return aliasedKey === directKey ? [directKey] : [directKey, aliasedKey];
}

/**
 * Normalize item_type from CSV.
 *
 * Supported (case-insensitive):
 * - "hearing_aid", "cihaz"   → "hearing_aid"
 * - "charger", "aksesuar", "sarg", "şarj" → "charger"
 *
 * IMPORTANT:
 * - Burada hata fırlatılırsa bu blocking kabul edilir
 *   (item_type kritik alan → satır import edilmez).
 */
export function normalizeItemType(raw: string): InventoryItemType {
  const v = raw.trim().toLowerCase();
  if (!v) {
    throw new Error('item_type alanı boş olamaz.');
  }
  if (v === 'hearing_aid' || v === 'cihaz') return 'hearing_aid';
  if (v === 'charger' || v === 'aksesuar' || v === 'sarg' || v === 'şarj') {
    return 'charger';
  }
  throw new Error(
    'item_type değeri "hearing_aid" veya "charger" (veya Türkçe karşılığı) olmalıdır.',
  );
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
 * - Hatalıysa sadece warning; varsayılan "in_stock" kullanılır.
 */
function normalizeStatus(raw: string): InventoryStatus {
  const v = raw.trim().toLowerCase();
  if (!v || v === 'stok' || v === 'stock' || v === 'in_stock') return 'in_stock';
  if (v === 'sold' || v === 'satildi' || v === 'satıldı') return 'sold';
  if (v === 'repair' || v === 'tamirde') return 'repair';
  throw new Error(
    'status değeri "in_stock", "sold" veya "repair" (veya Türkçe karşılığı) olmalıdır.',
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
 * - brand / device_brand          → marka (**zorunlu**)
 * - model / device_model          → model (**zorunlu**)
 * - item_type                     → "hearing_aid" | "charger" (**zorunlu**)
 * - barcode                       → barkod (opsiyonel)
 * - serial_no                     → seri numarası (**zorunlu**)
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
 *   * item_type boş veya geçersiz
 *   * serial_no boş
 *   * purchase_price ve list_price CSV'de boş + katalogta da bu model için fiyat bulunamıyor
 *
 * - Diğer tüm parsing sorunları:
 *   * Satır valid kalır (valid = true),
 *   * Uyarı metni validation_error içine yazılır.
 *
 * Dikkat:
 * - Yeni stok importunda ear_side hiç kullanılmıyor. Cihaz yönü sadece
 *   hastaya bağlanırken belirleniyor.
 */
export function buildInventoryImportPayload(args: {
  orgId: string;
  jobId: string;
  csvObjects: CsvRowObj[];
  catalogPriceMap?: CatalogPriceMap;
  barcodeCatalogKeyMap?: BarcodeCatalogKeyMap;
}): InventoryImportBuildResult {
  const { orgId, jobId, csvObjects, catalogPriceMap, barcodeCatalogKeyMap } =
    args;

  const totalRows = csvObjects.length;
  let importedCount = 0;
  let errorCount = 0;

  const importRowsPayload: ImportRowPayload[] = [];
  const inventoryItemsPayload: InventoryItemImportPayload[] = [];

  csvObjects.forEach((row, idx) => {
    const rowIndex = idx + 2; // 1 = header, so rows start at 2

    // Eski format: brand / model
    // Yeni format: device_brand / device_model
    const rawBrand = (row['brand'] ?? row['device_brand'] ?? '').trim();
    const rawModel = (row['model'] ?? row['device_model'] ?? '').trim();

    const rawItemType = (row['item_type'] ?? '').trim();
    const rawBarcode = (row['barcode'] ?? '').trim();
    const rawSerialNo = (row['serial_no'] ?? '').trim();
    const rawStatus = (row['status'] ?? '').trim();

    const rawPurchasePrice = (row['purchase_price'] ?? '').trim();
    const rawListPrice =
      (row['list_price'] ?? '').trim() || (row['device_price'] ?? '').trim();

    const rawPurchaseDate = (row['purchase_date'] ?? '').trim();

    const rawNotes = (row['notes'] ?? '').trim();
    const rawPatientNationalId = (row['patient_national_id'] ?? '').trim();

    let valid = true;
    let blockingError: string | null = null;
    const warnings: string[] = [];

    // 1) Marka / model / serial_no zorunlu
    if (!rawBrand) {
      valid = false;
      blockingError = 'Marka (brand / device_brand) alanı boş olamaz.';
    } else if (!rawModel) {
      valid = false;
      blockingError = 'Model (model / device_model) alanı boş olamaz.';
    } else if (!rawSerialNo) {
      valid = false;
      blockingError = 'serial_no alanı boş olamaz.';
    }

    let itemType: InventoryItemType = 'hearing_aid';
    let status: InventoryStatus = 'in_stock';
    let purchasePrice: number | null = null;
    let listPrice: number | null = null;

    // 2) item_type → kritik, hatalıysa blocking error
    if (valid) {
      try {
        itemType = normalizeItemType(rawItemType);
      } catch (e) {
        valid = false;
        blockingError = (e as Error).message;
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

    // 4) purchase_price → parse edilemezse warning, null
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

    // 5) list_price → parse edilemezse warning, null
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

    // 6) purchase_date → yalnızca format kontrolü, hatalıysa warning
    if (valid && rawPurchaseDate) {
      if (!isParsablePurchaseDate(rawPurchaseDate)) {
        warnings.push(
          'purchase_date formatı geçersiz, tarih yok sayıldı (beklenen: dd.MM.yyyy veya yyyy-MM-dd).',
        );
      }
    }

    // 7) Hem CSV'de hem de hesaplanan değerlerde fiyat boşsa → katalogtan doldurmayı dene
    if (valid && purchasePrice == null && listPrice == null && catalogPriceMap) {
      const lookupKeys = makeCatalogPriceLookupKeys(rawBrand, rawModel, itemType);
      const barcodeCatalogKey = rawBarcode
        ? barcodeCatalogKeyMap?.[normalizeBarcodeForLookup(rawBarcode)]
        : undefined;
      const candidateKeys = barcodeCatalogKey
        ? [
            barcodeCatalogKey,
            ...lookupKeys.filter((key) => key !== barcodeCatalogKey),
          ]
        : lookupKeys;
      let catalog: CatalogPriceMapEntry | undefined;
      let matchedByBarcode = false;

      for (const key of candidateKeys) {
        catalog = catalogPriceMap[key];
        if (catalog) {
          matchedByBarcode = key === barcodeCatalogKey;
          break;
        }
      }

      if (catalog) {
        purchasePrice =
          typeof catalog.purchase_price === 'number' ? catalog.purchase_price : null;
        listPrice = typeof catalog.list_price === 'number' ? catalog.list_price : null;

        if (purchasePrice === null && listPrice === null) {
          // Katalog satırı var ama her iki fiyat da null → blocking error
          valid = false;
          blockingError =
            'CSV satırında purchase_price ve list_price boş, ve katalogta da bu model için fiyat değeri yok.';
        } else {
          warnings.push(
            matchedByBarcode
              ? 'purchase_price ve list_price CSVde bos oldugu icin barkodla eslesen katalog fiyatlari ile dolduruldu.'
              : 'purchase_price ve list_price CSV’de boş olduğu için katalog fiyatları ile dolduruldu.',
          );
        }
      } else {
        // Katalogta hiç satır yok → blocking error
        valid = false;
        blockingError =
          'CSV satırında purchase_price ve list_price boş, ve katalogta bu marka+model+item_type için fiyat bulunamadı.';
      }
    }

    const validation_error =
      !valid ? blockingError : warnings.length > 0 ? warnings.join(' | ') : null;

    importRowsPayload.push({
      job_id: jobId,
      row_index: rowIndex,
      raw_brand: rawBrand || null,
      raw_model: rawModel || null,
      raw_item_type: rawItemType || null,
      raw_barcode: rawBarcode || null,
      raw_serial_no: rawSerialNo || null,
      raw_status: rawStatus || null,
      raw_purchase_price: rawPurchasePrice || null,
      raw_list_price: rawListPrice || null,
      raw_purchase_date: rawPurchaseDate || null,
      raw_notes:
        rawNotes ||
        (rawPatientNationalId ? `legacy_patient_national_id=${rawPatientNationalId}` : null),
      valid,
      validation_error,
    });

    if (valid) {
      importedCount += 1;

      inventoryItemsPayload.push({
        org_id: orgId,
        brand: rawBrand,
        model: rawModel,
        item_type: itemType,
        barcode: rawBarcode || null,
        serial_no: rawSerialNo || null,
        // Yeni stok importunda cihaz yönsüz: ear_side hiç set edilmez.
        ear_side: null,
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
