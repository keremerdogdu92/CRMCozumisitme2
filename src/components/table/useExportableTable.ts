// src/components/table/useExportableTable.ts
// Shared hook that combines table preferences (columns + sorting)
// with CSV/XLSX export functionality.
//
// Responsibilities:
// - Wrap useTablePreferences for a given table key + userId.
// - Compute sortedRows using the column accessors (with null/date handling).
// - Provide CSV/XLSX export handlers that:
//    * Respect current visible columns (excluding non-exportable like "actions").
//    * Respect current sorted order.
//    * Use ExportSchema.getValue for cell values.

import { useMemo } from 'react';
import { useTablePreferences } from './useTablePreferences';
import type { TableColumnDef, SortDirection } from './tableTypes';
import type { ExportSchema, ExportColumnDef } from './exportSchema';
import { exportToCsvFile, exportToXlsxFile } from '../../utils/csvUtils';

type UseExportableTableParams<TRow> = {
  tableKey: string;
  rows: TRow[];
  columns: TableColumnDef<TRow>[];
  userId: string | null;
  exportSchema: ExportSchema<TRow>;
  /**
   * Optional: column ids that should *never* be exported (e.g. "actions").
   * If omitted, nothing is excluded by default.
   */
  nonExportableColumnIds?: string[];
};

export type UseExportableTableResult<TRow> = {
  sortedRows: TRow[];
  visibleColumns: TableColumnDef<TRow>[];
  prefsState: {
    sortBy: string | null;
    sortDir: SortDirection;
  };
  isColumnVisible: (id: string) => boolean;
  toggleColumn: (id: string) => void;
  setSort: (id: string) => void;
  handleExportCsv: () => void;
  handleExportXlsx: () => void;
};

/**
 * Normalizes a cell value before passing it to CSV/XLSX helpers.
 * ExportSchema.getValue should ideally already return "display-ready" values,
 * so this function is intentionally conservative.
 */
function normalizeExportValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // ISO format keeps it unambiguous; caller can pre-format if desired.
    return value.toISOString();
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function sortRows<TRow>(
  rows: TRow[],
  columns: TableColumnDef<TRow>[],
  sortBy: string | null,
  sortDir: SortDirection,
): TRow[] {
  if (!sortBy) return rows;

  const col = columns.find((c) => c.id === sortBy);
  if (!col || !col.sortable) return rows;

  const accessor =
    col.accessor ?? ((row: TRow) => (row as Record<string, unknown>)[col.id]);

  const result = [...rows];

  result.sort((a, b) => {
    const va = accessor(a);
    const vb = accessor(b);

    const aNull = va == null;
    const bNull = vb == null;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;

    // String: try date parse, then lexicographic
    if (typeof va === 'string' && typeof vb === 'string') {
      const ta = Date.parse(va);
      const tb = Date.parse(vb);
      if (!Number.isNaN(ta) && !Number.isNaN(tb)) {
        if (ta < tb) return sortDir === 'asc' ? -1 : 1;
        if (ta > tb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    }

    // Number
    if (typeof va === 'number' && typeof vb === 'number') {
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    }

    // Fallback for other comparable types
    const av = va as number;
    const bv = vb as number;
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return result;
}

function intersectExportColumns<TRow>(
  visibleColumns: TableColumnDef<TRow>[],
  schemaColumns: ExportColumnDef<TRow>[],
  nonExportableColumnIds: string[],
): ExportColumnDef<TRow>[] {
  const visibleIds = new Set(
    visibleColumns.map((c) => c.id).filter((id) => !nonExportableColumnIds.includes(id)),
  );
  const intersected = schemaColumns.filter((c) => visibleIds.has(c.id));

  // Eğer görünür kolonlardan hiçbiri exportSchema ile kesişmiyorsa,
  // fallback olarak tüm schema kolonlarını kullan (yine non-exportable hariç).
  if (intersected.length === 0) {
    return schemaColumns.filter(
      (c) => !nonExportableColumnIds.includes(c.id),
    );
  }

  return intersected;
}

export function useExportableTable<TRow>({
  tableKey,
  rows,
  columns,
  userId,
  exportSchema,
  nonExportableColumnIds = [],
}: UseExportableTableParams<TRow>): UseExportableTableResult<TRow> {
  const {
    state,
    visibleColumns,
    toggleColumn,
    setSort,
    isColumnVisible,
  } = useTablePreferences<TRow>(tableKey, columns, userId);

  const sortedRows = useMemo(
    () => sortRows(rows, columns, state.sortBy, state.sortDir),
    [rows, columns, state.sortBy, state.sortDir],
  );

  const handleExportCsv = () => {
    if (!sortedRows.length) return;

    const exportColumns = intersectExportColumns(
      visibleColumns,
      exportSchema.columns,
      nonExportableColumnIds,
    );
    if (!exportColumns.length) return;

    const headers = exportColumns.map((schemaCol) => {
      if (schemaCol.label) return schemaCol.label;
      const tableCol = columns.find((c) => c.id === schemaCol.id);
      return tableCol?.label ?? schemaCol.id;
    });

    const rowsMatrix = sortedRows.map((row) =>
      exportColumns.map((schemaCol) =>
        normalizeExportValue(schemaCol.getValue(row)),
      ),
    );

    exportToCsvFile({
      fileName: exportSchema.fileBaseName,
      headers,
      rows: rowsMatrix,
    });
  };

  const handleExportXlsx = () => {
    if (!sortedRows.length) return;

    const exportColumns = intersectExportColumns(
      visibleColumns,
      exportSchema.columns,
      nonExportableColumnIds,
    );
    if (!exportColumns.length) return;

    const headers = exportColumns.map((schemaCol) => {
      if (schemaCol.label) return schemaCol.label;
      const tableCol = columns.find((c) => c.id === schemaCol.id);
      return tableCol?.label ?? schemaCol.id;
    });

    const rowsMatrix = sortedRows.map((row) =>
      exportColumns.map((schemaCol) =>
        normalizeExportValue(schemaCol.getValue(row)),
      ),
    );

    exportToXlsxFile({
      fileName: exportSchema.fileBaseName,
      headers,
      rows: rowsMatrix,
    });
  };

  return {
    sortedRows,
    visibleColumns,
    prefsState: {
      sortBy: state.sortBy,
      sortDir: state.sortDir,
    },
    isColumnVisible,
    toggleColumn,
    setSort,
    handleExportCsv,
    handleExportXlsx,
  };
}
