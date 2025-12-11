// src/components/table/tableTypes.ts
// Generic table column definitions shared by all feature tables.

export type SortDirection = 'asc' | 'desc';

export type TableColumnDef<TRow> = {
  id: string;                 // internal column key, e.g. 'full_name', 'created_at'
  label: string;              // header text
  isDefaultVisible?: boolean; // initial visibility, default: true
  sortable?: boolean;         // can user sort by this column?
  accessor?: (row: TRow) => unknown; // optional value accessor for sorting
};
