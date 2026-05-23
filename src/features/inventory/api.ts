// src/features/inventory/api.ts
// Summary: Public API barrel for the Inventory feature.
// Integrations:
// - Listing: fetchInventoryItems/useInventoryItems (supports SoftDeleteMode).
// - Create: createInventoryItem/useCreateInventoryItemMutation.
// - Soft delete: softDeleteInventoryItem/restoreInventoryItem + mutation hooks.
// - Import/catalog APIs remain unchanged.

export { INVENTORY_QUERY_KEY } from './api.keys';

export { fetchInventoryItems, useInventoryItems } from './api.fetch';

export {
  createInventoryItem,
  useCreateInventoryItemMutation,
} from './api.create';

export {
  softDeleteInventoryItem,
  restoreInventoryItem,
  useSoftDeleteInventoryItemMutation,
  useRestoreInventoryItemMutation,
} from './api.delete';

export {
  importInventoryFromCsv,
  useInventoryCsvImportMutation,
} from './api.import';

export {
  findActiveInventoryItemBySerial,
  resolveInventoryImportRow,
  type InventoryDuplicateLookupRow,
  type InventoryImportRowResolveInput,
} from './api.importFix';

export {
  fetchCatalogPriceForInventory,
  fetchInventoryStockThresholds,
  searchCatalogPricesForInventory,
  saveInventoryStockThreshold,
  CATALOG_ITEM_TYPES,
  fetchCatalogRowsForInventory,
  type InventoryCatalogPriceResult,
  type InventoryCatalogSearchRow,
} from './api.catalog';
