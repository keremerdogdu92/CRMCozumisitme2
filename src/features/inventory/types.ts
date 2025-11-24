// src/features/inventory/types.ts
// Shared types for the Inventory (stok) feature.

export type InventoryItemType = 'hearing_aid' | 'charger';

export type InventoryStatus = 'in_stock' | 'sold' | 'repair';

export type EarSide = 'right' | 'left' | 'bilateral' | 'none';

/**
 * One inventory row from public.inventory_items.
 */
export type InventoryItemRow = {
  id: string;
  org_id: string;
  brand: string;
  model: string;
  item_type: InventoryItemType;
  barcode: string | null;
  serial_no: string | null;
  ear_side: EarSide;
  status: InventoryStatus;
  purchase_price: number | null;
  list_price: number | null;
  sold_patient_id: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Form values for creating a new inventory item.
 * Strings because they come from input fields.
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
