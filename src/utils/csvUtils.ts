// src/utils/csvUtils.ts
// Shared CSV helpers for features that import/export data.
//
// parseSimpleCsv:
//  - Accepts "," or ";" as delimiter (auto-detected from header line)
//  - Trims whitespace
//  - Skips completely empty lines
//
// Export helpers:
//  - exportToCsvFile: download a CSV with given headers + rows
//  - exportToXlsxFile: download an XLSX with given headers + rows
//    (requires "xlsx" package on the client bundle)

import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

export type ExportArrayOptions = {
  fileName: string; // base file name, extension will be added if missing
  headers: string[];
  rows: (string | number | null | undefined)[][];
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

/**
 * RFC-aware CSV parser for import flows that need quoted values, delimiters,
 * and comment rows handled correctly. Lines starting with "#" are ignored.
 */
export function parseRobustCsv(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text, {
    comments: '#',
    delimiter: '',
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
  });

  if (result.errors.length > 0) {
    const firstError = result.errors[0];
    const rowInfo =
      typeof firstError.row === 'number' ? ` satir ${firstError.row + 1}` : '';
    throw new Error(`CSV okunamadi${rowInfo}: ${firstError.message}`);
  }

  const parsedRows = result.data
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (parsedRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headers, ...rows] = parsedRows;

  return {
    headers: headers.map((h) => h.trim().toLowerCase()),
    rows,
  };
}

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape if contains separators, quotes or newlines
  if (/[",\n;]/.test(str)) {
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return str;
}

function triggerDownload(blob: Blob, fileName: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Non-browser environment: do nothing.
    return;
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Export a simple array-of-arrays as CSV and trigger a browser download.
 */
export function exportToCsvFile(options: ExportArrayOptions): void {
  const { fileName, headers, rows } = options;

  if (!headers || headers.length === 0) return;

  const headerLine = headers.map(toCsvCell).join(',');
  const bodyLines = rows.map((row) =>
    row.map((cell) => toCsvCell(cell)).join(','),
  );
  const csvContent =
    headerLine + (bodyLines.length > 0 ? '\n' + bodyLines.join('\n') : '');

  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;',
  });

  const finalName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  triggerDownload(blob, finalName);
}

/**
 * Export a simple array-of-arrays as XLSX and trigger a browser download.
 * Requires "xlsx" dependency to be installed.
 */
export function exportToXlsxFile(options: ExportArrayOptions): void {
  const { fileName, headers, rows } = options;

  if (!headers || headers.length === 0) return;
  if (typeof window === 'undefined') {
    return;
  }

  const data: (string | number)[][] = [
    headers,
    ...rows.map((row) =>
      row.map((cell) => {
        if (cell === null || cell === undefined) return '';
        if (typeof cell === 'number') return cell;
        return String(cell);
      }),
    ),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  const xlsxBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  });

  const blob = new Blob([xlsxBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const finalName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  triggerDownload(blob, finalName);
}
