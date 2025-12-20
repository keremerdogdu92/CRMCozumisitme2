// src/components/table/exportSchema.ts
// Shared export schema types for table CSV/XLSX exports.
// Keeps “what to export” definition separate from table UI rendering.

export type ExportColumnDef<TRow> = {
  /**
   * Must match the table column id (TableColumnDef.id).
   * Used to intersect with visible columns before export.
   */
  id: string;
  /**
   * Optional export header label. If omitted, the table column's label is used.
   */
  label?: string;
  /**
   * Returns the final cell value to be written into CSV/XLSX.
   * You can do any formatting (date/price/etc.) here.
   */
  getValue: (row: TRow) => unknown;
};

export type ExportSchema<TRow> = {
  /**
   * Base file name without extension. E.g. "patients_export".
   * The exporter will append ".csv" or ".xlsx".
   */
  fileBaseName: string;
  /**
   * Exportable columns definition. Only columns that are also visible in the
   * table at export time will be included in the output.
   */
  columns: ExportColumnDef<TRow>[];
};
