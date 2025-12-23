// src/features/inventory/api.ts
// Public API barrel for the Inventory feature.
// Keeps existing imports stable while delegating to smaller modules.

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
