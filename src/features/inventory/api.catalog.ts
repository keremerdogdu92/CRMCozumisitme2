// src/features/inventory/api.catalog.ts
// Summary: Shared catalog price lookup helper for Inventory UI and flows.
// Reads from current_device_model_prices_public (org-scoped). No caching here;
// callers should decide when/how often to call.

import { supabaseClient } from '../../utils/supabaseClient';
import type { InventoryItemType } from './types';

export type InventoryCatalogPriceResult = {
  purchase_price: number | null;
  list_price: number | null;
};

/**
 * Fetch catalog prices for an (org_id, brand, model, item_type) tuple.
 * Returns null if not found.
 *
 * NOTE:
 * - Supabase numeric columns may come back as string → normalize to number.
 */
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
    console.error('Failed to load catalog prices:', error);
    throw new Error('CATALOG_FETCH: ' + error.message);
  }

  if (!data) return null;

  const toNumberOrNull = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const num = Number(v);
    if (!Number.isFinite(num)) return null;
    return Number(num.toFixed(2));
  };

  return {
    purchase_price: toNumberOrNull((data as any).purchase_price),
    list_price: toNumberOrNull((data as any).list_price),
  };
}
