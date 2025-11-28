// src/features/inventory/inventoryPriceUtils.ts
// Shared helpers for parsing price strings in the Inventory feature.

/**
 * Parse a user-entered price string into a nullable number.
 * - Accepts "," or "." as decimal separator.
 * - Strips whitespace.
 * - Enforces >= 0.
 */
export function parsePriceOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
  const value = Number(normalized);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Fiyat alanları için geçerli (0 veya üzeri) bir sayı girin.');
  }

  return Number(value.toFixed(2));
}
