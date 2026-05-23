// src/features/inventory/api.catalog.ts
// Catalog price helpers for inventory create/import/fix flows.

import { supabaseClient } from '../../utils/supabaseClient';
import type {
  CatalogItemType,
  InventoryItemType,
  InventoryStockThresholdRow,
} from './types';
import {
  findCatalogMatch,
  normalizeCatalogMatchText,
  toNumberOrNull,
  type CatalogMatchType,
  type CatalogPriceLike,
} from './catalogMatching';

export type InventoryCatalogPriceResult = {
  catalogModelId: string | null;
  brand: string;
  model: string;
  itemType: CatalogItemType;
  purchase_price: number | null;
  list_price: number | null;
  valid_from: string | null;
  battery_type: string | null;
  details: string | null;
  matchType: CatalogMatchType;
};

export type InventoryCatalogSearchRow = Omit<
  InventoryCatalogPriceResult,
  'matchType'
>;

type CatalogPriceRow = CatalogPriceLike & {
  id: string | null;
  org_id: string | null;
};

function mapCatalogRow(
  row: CatalogPriceRow,
  matchType: CatalogMatchType = 'direct',
): InventoryCatalogPriceResult {
  return {
    catalogModelId: row.id ?? null,
    brand: row.brand ?? '',
    model: row.model ?? '',
    itemType: (row.item_type ?? 'hearing_aid') as CatalogItemType,
    purchase_price: toNumberOrNull(row.purchase_price),
    list_price: toNumberOrNull(row.list_price),
    valid_from: row.valid_from ?? null,
    battery_type: row.battery_type ?? null,
    details: row.details ?? null,
    matchType,
  };
}

export async function fetchCatalogRowsForInventory(args: {
  orgId: string;
  itemTypes?: CatalogItemType[];
}): Promise<CatalogPriceRow[]> {
  const { orgId, itemTypes } = args;

  let query = supabaseClient
    .from('current_device_model_prices_public')
    .select(
      'id, org_id, brand, model, item_type, purchase_price, list_price, valid_from, battery_type, details',
    )
    .eq('org_id', orgId);

  if (itemTypes && itemTypes.length > 0) {
    query =
      itemTypes.length === 1
        ? query.eq('item_type', itemTypes[0])
        : query.in('item_type', itemTypes);
  }

  const { data, error } = await query.order('brand').order('model');

  if (error) {
    console.error('Failed to load catalog rows for inventory:', error);
    throw new Error('INVENTORY_CATALOG_FETCH: ' + error.message);
  }

  return (data ?? []) as CatalogPriceRow[];
}

export async function fetchCatalogPriceForInventory(args: {
  orgId: string;
  brand: string;
  model: string;
  itemType: InventoryItemType;
}): Promise<InventoryCatalogPriceResult | null> {
  const rows = await fetchCatalogRowsForInventory({
    orgId: args.orgId,
    itemTypes: [args.itemType],
  });

  const match = findCatalogMatch({
    rows,
    brand: args.brand,
    model: args.model,
    itemType: args.itemType,
  });

  return match ? mapCatalogRow(match.row as CatalogPriceRow, match.matchType) : null;
}

export async function searchCatalogPricesForInventory(args: {
  orgId: string;
  query: string;
  itemType?: InventoryItemType | CatalogItemType | 'all';
  limit?: number;
}): Promise<InventoryCatalogSearchRow[]> {
  const { orgId, query, itemType = 'all', limit = 20 } = args;
  const rows = await fetchCatalogRowsForInventory({
    orgId,
    itemTypes: itemType === 'all' ? undefined : [itemType],
  });
  const normalizedQuery = normalizeCatalogMatchText(query);
  const terms = normalizedQuery.split(' ').filter(Boolean);

  return rows
    .filter((row) => {
      if (!terms.length) return true;
      const haystack = normalizeCatalogMatchText(
        `${row.brand ?? ''} ${row.model ?? ''} ${row.item_type ?? ''}`,
      );
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, limit)
    .map((row) => {
      const mapped = mapCatalogRow(row);
      return {
        catalogModelId: mapped.catalogModelId,
        brand: mapped.brand,
        model: mapped.model,
        itemType: mapped.itemType,
        purchase_price: mapped.purchase_price,
        list_price: mapped.list_price,
        valid_from: mapped.valid_from,
        battery_type: mapped.battery_type,
        details: mapped.details,
      };
    });
}

export const CATALOG_ITEM_TYPES: CatalogItemType[] = [
  'hearing_aid',
  'charger',
  'receiver',
  'battery',
];

export async function fetchInventoryStockThresholds(
  orgId: string,
): Promise<InventoryStockThresholdRow[]> {
  const { data, error } = await supabaseClient
    .from('inventory_stock_thresholds')
    .select('id, org_id, item_type, catalog_model_id, minimum_stock')
    .eq('org_id', orgId);

  if (error) {
    throw new Error('INVENTORY_STOCK_THRESHOLDS_FETCH: ' + error.message);
  }

  return (data ?? []) as InventoryStockThresholdRow[];
}

export async function saveInventoryStockThreshold(args: {
  orgId: string;
  itemType: CatalogItemType | null;
  catalogModelId: string | null;
  minimumStock: number | null;
}): Promise<void> {
  const { orgId, itemType, catalogModelId, minimumStock } = args;

  if (minimumStock == null) {
    let deleteQuery = supabaseClient
      .from('inventory_stock_thresholds')
      .delete()
      .eq('org_id', orgId);

    deleteQuery = catalogModelId
      ? deleteQuery.eq('catalog_model_id', catalogModelId)
      : deleteQuery.is('catalog_model_id', null).eq('item_type', itemType);

    const { error } = await deleteQuery;
    if (error) {
      throw new Error('INVENTORY_STOCK_THRESHOLD_DELETE: ' + error.message);
    }
    return;
  }

  if (minimumStock < 0 || !Number.isInteger(minimumStock)) {
    throw new Error('Minimum stok 0 veya daha buyuk tam sayi olmalidir.');
  }

  let existingQuery = supabaseClient
    .from('inventory_stock_thresholds')
    .select('id')
    .eq('org_id', orgId);

  existingQuery = catalogModelId
    ? existingQuery.eq('catalog_model_id', catalogModelId)
    : existingQuery.is('catalog_model_id', null).eq('item_type', itemType);

  const { data: existing, error: existingError } =
    await existingQuery.maybeSingle();

  if (existingError) {
    throw new Error('INVENTORY_STOCK_THRESHOLD_LOOKUP: ' + existingError.message);
  }

  if (existing?.id) {
    const { error } = await supabaseClient
      .from('inventory_stock_thresholds')
      .update({
        minimum_stock: minimumStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id as string);

    if (error) {
      throw new Error('INVENTORY_STOCK_THRESHOLD_UPDATE: ' + error.message);
    }
    return;
  }

  const { error } = await supabaseClient
    .from('inventory_stock_thresholds')
    .insert({
      org_id: orgId,
      item_type: catalogModelId ? null : itemType,
      catalog_model_id: catalogModelId,
      minimum_stock: minimumStock,
    });

  if (error) {
    throw new Error('INVENTORY_STOCK_THRESHOLD_INSERT: ' + error.message);
  }
}
