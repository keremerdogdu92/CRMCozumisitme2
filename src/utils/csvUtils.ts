// src/utils/csvUtils.ts
// Shared CSV helpers for features that import data from text files.
//
// parseSimpleCsv:
//  - Accepts "," or ";" as delimiter (auto-detected from header line)
//  - Trims whitespace
//  - Skips completely empty lines

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

/**
 * Simple CSV parser that accepts "," or ";" as delimiter.
 * Returns lowercase, trimmed headers and an array of row arrays.
 */
export function parseSimpleCsv(text: string): ParsedCsv {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semiCount = (headerLine.match(/;/g) ?? []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  const headers = headerLine
    .split(delimiter)
    .map((h) => h.trim().toLowerCase());

  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(delimiter).map((c) => c.trim());
    if (cols.every((c) => !c)) continue;
    rows.push(cols);
  }

  return { headers, rows };
}
