// src/features/inventory/api.ts
// Summary: Inventory public API barrel. Adds catalog price fetch helper export
// so UI can auto-fill prices when brand+model+item_type are chosen.

export { INVENTORY_QUERY_KEY } from './api.keys';

export { fetchInventoryItems, useInventoryItems } from './api.fetch';

export {
  createInventoryItem,
  useCreateInventoryItemMutation,
} from './api.create';

export {
  importInventoryFromCsv,
  useInventoryCsvImportMutation,
} from './api.import';

export {
  fetchCatalogPriceForInventory,
  type InventoryCatalogPriceResult,
} from './api.catalog';
