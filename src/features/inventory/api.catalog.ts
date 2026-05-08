// src/features/inventory/api.catalog.ts
// Summary: Shared helper to fetch catalog prices (purchase/list) for Inventory UI.
// Reads from current_device_model_prices_public, org-scoped.
// Keeps parsing defensive because numeric columns may return as string.

import { supabaseClient } from '../../utils/supabaseClient';
import type { InventoryItemType } from './types';

export type InventoryCatalogPriceResult = {
  purchase_price: number | null;
  list_price: number | null;
};

type CatalogPriceRow = {
  purchase_price: unknown;
  list_price: unknown;
};

export async function fetchCatalogPriceForInventory(args: {
  orgId: string;
  brand: string;
  model: string;
  itemType: InventoryItemType;
}): Promise<InventoryCatalogPriceResult | null> {
  const { orgId, brand, model, itemType } = args;

  const { data, error } = await supabaseClient
    .from('current_device_model_prices_public')
    .select('purchase_price, list_price')
    .eq('org_id', orgId)
    .eq('brand', brand.trim())
    .eq('model', model.trim())
    .eq('item_type', itemType)
    .maybeSingle();

  if (error) {
    console.error('Failed to load catalog prices for inventory:', error);
    throw new Error('INVENTORY_CATALOG_FETCH: ' + error.message);
  }

  if (!data) return null;

  const toNumberOrNull = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const num = Number(v);
    if (!Number.isFinite(num)) return null;
    return Number(num.toFixed(2));
  };

  return {
    purchase_price: toNumberOrNull((data as CatalogPriceRow).purchase_price),
    list_price: toNumberOrNull((data as CatalogPriceRow).list_price),
  };
}
