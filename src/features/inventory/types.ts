// src/features/inventory/types.ts
// Summary: Shared types for the Inventory (stok) feature.

export type InventoryItemType = 'hearing_aid' | 'charger';
export type CatalogItemType =
  | InventoryItemType
  | 'receiver'
  | 'battery';

export type InventoryStatus = 'in_stock' | 'sold' | 'repair';

/**
 * Ear side as used in forms.
 * - 'none' means "not set yet / not applicable" on the UI.
 * - In the database, 'none' is stored as NULL.
 */
export type EarSide = 'right' | 'left' | 'bilateral' | 'none';

/**
 * One inventory row from public.inventory_items.
 * Note: ear_side can be null in the database, so we model it as EarSide | null here.
 */
export type InventoryItemRow = {
  id: string;
  org_id: string;
  brand: string;
  model: string;
  item_type: InventoryItemType;
  catalog_model_id: string | null;
  barcode: string | null;
  serial_no: string | null;
  ear_side: EarSide | null;
  status: InventoryStatus;

  /**
   * purchase_price: geliş fiyatı (firma alış fiyatın).
   * list_price: katalogda tutulan tavsiye edilen liste fiyatı.
   * device_price: bu satıra karşılık gelen gerçek satış tutarı (cihaz başı),
   *               legacy hastalardan paylaştırma script'i ile dolduruldu.
   */
  purchase_price: number | null;
  list_price: number | null;
  device_price: number | null;

  sold_patient_id: string | null;
  sold_at: string | null;
  /** Resolved from patients.full_name via sold_patient_id; null if not sold or not found. */
  sold_patient_name: string | null;

  created_at: string;
  updated_at: string;

  /** Soft delete timestamp; null if aktif satır. */
  deleted_at: string | null;

  /**
   * Soft delete metadata (optional).
   * These fields may be null depending on DB state and row history.
   */
  deleted_by: string | null;
  delete_reason: string | null;
};

/**
 * Form values for creating a new inventory item.
 * Strings because they come from input fields.
 *
 * Not: Yeni stok kaydında device_price girilmiyor; cihaz satıldığında
 * ayrı bir süreçle doldurulacak.
 */
export type NewInventoryItemForm = {
  brand: string;
  model: string;
  itemType: InventoryItemType;
  earSide: EarSide;
  barcode: string;
  serialNo: string;
  purchasePrice: string;
  listPrice: string;
};

export type UpdateInventoryItemForm = NewInventoryItemForm & {
  id: string;
};

/**
 * Result summary for CSV import jobs.
 */
export type InventoryImportSummary = {
  jobId: string;
  totalRows: number;
  importedCount: number;
  errorCount: number;
  warningCount: number;
  duplicateCount: number;
};

export type InventoryStockThresholdRow = {
  id: string;
  org_id: string;
  item_type: CatalogItemType | null;
  catalog_model_id: string | null;
  minimum_stock: number;
};
