// src/features/inventory/catalogMatching.ts
// Pure helpers shared by inventory import, manual stock create, and row fixes.

import type { InventoryItemType } from './types';

export type CatalogPriceLike = {
  id?: string | null;
  brand: string | null;
  model: string | null;
  item_type: InventoryItemType | null;
  purchase_price: unknown;
  list_price: unknown;
  valid_from?: string | null;
  battery_type?: string | null;
  details?: string | null;
};

export type CatalogMatchType = 'barcode' | 'direct' | 'alias';

export type CatalogMatchResult<T extends CatalogPriceLike = CatalogPriceLike> = {
  row: T;
  key: string;
  matchType: CatalogMatchType;
};

export function normalizeCatalogMatchText(raw: string): string {
  return raw
    .trim()
    .replace(/\u0130/g, 'i')
    .replace(/\u0049/g, 'i')
    .replace(/\u0131/g, 'i')
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

export function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const num = Number(v);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(2));
}

export function buildCatalogPriceMap<T extends CatalogPriceLike>(
  rows: T[],
): Record<string, T> {
  const map: Record<string, T> = {};

  rows.forEach((row) => {
    if (!row.brand || !row.model || !row.item_type) return;
    map[makeCatalogPriceKey(row.brand, row.model, row.item_type)] = row;
  });

  return map;
}

export function findCatalogMatch<T extends CatalogPriceLike>(args: {
  rows: T[];
  brand: string;
  model: string;
  itemType: InventoryItemType;
  barcodeCatalogKey?: string;
}): CatalogMatchResult<T> | null {
  const { rows, brand, model, itemType, barcodeCatalogKey } = args;
  const map = buildCatalogPriceMap(rows);
  const lookupKeys = makeCatalogPriceLookupKeys(brand, model, itemType);
  const candidateKeys = barcodeCatalogKey
    ? [barcodeCatalogKey, ...lookupKeys.filter((key) => key !== barcodeCatalogKey)]
    : lookupKeys;

  for (const key of candidateKeys) {
    const row = map[key];
    if (!row) continue;

    if (barcodeCatalogKey && key === barcodeCatalogKey) {
      return { row, key, matchType: 'barcode' };
    }

    return {
      row,
      key,
      matchType: key === lookupKeys[0] ? 'direct' : 'alias',
    };
  }

  return null;
}
