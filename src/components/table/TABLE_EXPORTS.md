<!-- docs/TABLE_EXPORTS.md -->
# Table Exports (CSV / XLSX)

## Purpose

All list tables (patients, inventory, references, trials, etc.) should:

- Share the same behavior for:
  - Column visibility (per user)
  - Sorting
  - CSV/XLSX export
- Export data that matches:
  - Current visible columns
  - Current sorted order

This document explains the shared utilities:

- `useTablePreferences`
- `useExportableTable`
- `exportSchema.ts`
- `TableExportButtons`

---

## Architecture

### 1. `useTablePreferences`

Low-level hook responsible for:

- Which columns are visible
- Current sort column and direction
- Storing preferences per user and per table key

It does not know anything about export or file formats.

### 2. `exportSchema.ts`

Defines **what** to export for a given row type.

```ts
export type ExportColumnDef<TRow> = {
  id: string;                // must match TableColumnDef.id
  label?: string;            // optional header label override
  getValue: (row: TRow) => unknown; // returns display-ready cell value
};

export type ExportSchema<TRow> = {
  fileBaseName: string;      // e.g. "patients_export"
  columns: ExportColumnDef<TRow>[];
};
Each feature table defines its own ExportSchema<TRow> and passes it to useExportableTable.

3. useExportableTable
Higher-level hook that wraps useTablePreferences and export logic.

Responsibilities:

Call useTablePreferences(tableKey, columns, userId).

Compute sortedRows using the table column accessors.

Intersect visible columns with exportSchema.columns.

Provide handleExportCsv and handleExportXlsx handlers that:

Use exportSchema.fileBaseName for file names.

Use exportSchema.columns[*].getValue(row) for cell values.

Use the current sorted order and visible columns.

Optionally exclude non-exportable columns (e.g. "actions").

Signature:

ts
Kodu kopyala
const {
  sortedRows,
  visibleColumns,
  prefsState,
  isColumnVisible,
  toggleColumn,
  setSort,
  handleExportCsv,
  handleExportXlsx,
} = useExportableTable<TRow>({
  tableKey: 'some-table-key',
  rows,
  columns: TABLE_COLUMNS,
  userId,
  exportSchema: SOME_EXPORT_SCHEMA,
  nonExportableColumnIds: ['actions'],
});
4. TableExportButtons
UI-only component rendering:

“CSV indir”

“Excel indir”

It receives two callbacks:

tsx
Kodu kopyala
<TableExportButtons
  onExportCsv={handleExportCsv}
  onExportXlsx={handleExportXlsx}
/>
It does not implement any export logic itself.

Adding Export to a New Table
Steps for a new list table:

Define table columns as before:

ts
Kodu kopyala
const SOME_COLUMNS: TableColumnDef<SomeRow>[] = [
  { id: 'created_at', label: 'Kayıt', sortable: true, accessor: (r) => r.created_at },
  { id: 'full_name', label: 'Ad Soyad', sortable: true, accessor: (r) => r.full_name ?? '' },
  // ...
];
Define an export schema for this row type:

ts
Kodu kopyala
import type { ExportSchema } from '../../components/table/exportSchema';

const SOME_EXPORT_SCHEMA: ExportSchema<SomeRow> = {
  fileBaseName: 'some_export',
  columns: [
    { id: 'created_at', label: 'Kayıt', getValue: (r) => r.created_at },
    { id: 'full_name', label: 'Ad Soyad', getValue: (r) => r.full_name ?? '' },
    // Only columns defined here can be exported.
  ],
};
Use useExportableTable inside the table component:

ts
Kodu kopyala
const {
  sortedRows,
  visibleColumns,
  prefsState,
  isColumnVisible,
  toggleColumn,
  setSort,
  handleExportCsv,
  handleExportXlsx,
} = useExportableTable<SomeRow>({
  tableKey: 'some-table',
  rows: items,
  columns: SOME_COLUMNS,
  userId,
  exportSchema: SOME_EXPORT_SCHEMA,
  nonExportableColumnIds: ['actions'],
});
Render toolbar:

tsx
Kodu kopyala
<div className="flex items-center gap-2">
  <TableColumnsControl
    columns={SOME_COLUMNS}
    isColumnVisible={isColumnVisible}
    toggleColumn={toggleColumn}
  />
  <TableExportButtons
    onExportCsv={handleExportCsv}
    onExportXlsx={handleExportXlsx}
  />
</div>
Render table body using sortedRows and visibleColumns:

tsx
Kodu kopyala
<tbody>
  {sortedRows.map((row) => (
    <tr key={row.id}>
      {visibleColumns.map((col) => {
        // switch-case by col.id for custom cell layout
      })}
    </tr>
  ))}
</tbody>
Conventions and Best Practices
Dates:

Store as ISO strings in data.

Format for display in the table (e.g. formatDate) and/or via getValue in ExportSchema.

Money:

Store as number in data.

Use toLocaleString for UI.

Decide in ExportSchema whether export should be formatted (e.g. "10.500,00") or raw numeric.

Non-exportable columns:

Use nonExportableColumnIds, usually for "actions" or similar.

Future Extensions (Optional)
Filtered export:

Hook can optionally accept “filteredRows” instead of raw “rows”.

Server-side export:

Instead of client-side CSV/XLSX, send query params to an API route for large datasets.

kotlin
Kodu kopyala

```ts
// src/features/trials/TrialsTable.tsx 
// Tabular list view for trial rows with column visibility toggles and sorting.
// Preferences are stored per user via useTablePreferences(userId).
//
// Patch v2.1:
// - Existing: sorting + column visibility controls.
// Patch v2.2:
// - ADD: Export buttons (CSV + XLSX) next to column visibility control.
// - Export respects current visible columns and current sorted order.
// - Uses shared csv/xlsx helpers (exportToCsvFile / exportToXlsxFile).
// Patch v3.0:
// - Refactor: delegates sorting + export behavior to useExportableTable.
// - ADD: TRIALS_EXPORT_SCHEMA using shared ExportSchema<TrialRow>.
// - Table component now focuses only on layout and cell rendering.

import type { TrialRow } from './types';
import { TableColumnsControl } from '../../components/table/TableColumnsControl';
import type { TableColumnDef } from '../../components/table/tableTypes';
import { useCurrentProfile } from '../auth/useCurrentProfile';
import { TableExportButtons } from '../../components/table/TableExportButtons';
import type { ExportSchema } from '../../components/table/exportSchema';
import { useExportableTable } from '../../components/table/useExportableTable';

type TrialsTableProps = {
  items: TrialRow[];
  onSelectRow: (trial: TrialRow) => void;
};

type TrialTableColumnId =
  | 'created_at'
  | 'full_name'
  | 'phone'
  | 'first_meet_at'
  | 'next_meet_at'
  | 'reference'
  | 'note'
  | 'actions';

const TRIAL_COLUMNS: TableColumnDef<
  TrialRow & { _colId?: TrialTableColumnId }
>[] = [
  {
    id: 'created_at',
    label: 'Kayıt',
    sortable: true,
    isDefaultVisible: true,
    accessor: (t) => t.created_at ?? null,
  },
  {
    id: 'full_name',
    label: 'Ad Soyad',
    sortable: true,
    isDefaultVisible: true,
    accessor: (t) => t.full_name ?? '',
  },
  {
    id: 'phone',
    label: 'Telefon',
    sortable: false,
    isDefaultVisible: true,
    accessor: (t) => t.phone ?? '',
  },
  {
    id: 'first_meet_at',
    label: 'İlk Görüşme',
    sortable: true,
    isDefaultVisible: true,
    accessor: (t) => t.first_meet_at ?? null,
  },
  {
    id: 'next_meet_at',
    label: 'Sonraki Randevu',
    sortable: true,
    isDefaultVisible: true,
    accessor: (t) => t.next_meet_at ?? null,
  },
  {
    id: 'reference',
    label: 'Referans',
    sortable: true,
    isDefaultVisible: false,
    accessor: (t) => (t.reference_id ? 1 : 0),
  },
  {
    id: 'note',
    label: 'Not',
    sortable: false,
    isDefaultVisible: false,
    accessor: (t) => t.note ?? '',
  },
  {
    id: 'actions',
    label: 'İşlemler',
    sortable: false,
    isDefaultVisible: true,
  },
];

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function formatShortDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

// Export schema: defines which columns go to CSV/XLSX and how they are formatted.
const TRIALS_EXPORT_SCHEMA: ExportSchema<TrialRow> = {
  fileBaseName: 'trials_export',
  columns: [
    {
      id: 'created_at',
      label: 'Kayıt',
      getValue: (t) => formatShortDate(t.created_at),
    },
    {
      id: 'full_name',
      label: 'Ad Soyad',
      getValue: (t) => t.full_name ?? '',
    },
    {
      id: 'phone',
      label: 'Telefon',
      getValue: (t) => t.phone ?? '',
    },
    {
      id: 'first_meet_at',
      label: 'İlk Görüşme',
      getValue: (t) => formatShortDate(t.first_meet_at),
    },
    {
      id: 'next_meet_at',
      label: 'Sonraki Randevu',
      getValue: (t) => formatShortDate(t.next_meet_at),
    },
    {
      id: 'reference',
      label: 'Referans',
      getValue: (t) => (t.reference_id ? 'Var' : 'Yok'),
    },
    {
      id: 'note',
      label: 'Not',
      getValue: (t) => t.note ?? '',
    },
  ],
};

export function TrialsTable({ items, onSelectRow }: TrialsTableProps) {
  const { data: profile } = useCurrentProfile();
  const userId = profile?.id ?? null;

  const {
    sortedRows,
    visibleColumns,
    prefsState,
    isColumnVisible,
    toggleColumn,
    setSort,
    handleExportCsv,
    handleExportXlsx,
  } = useExportableTable<TrialRow>({
    tableKey: 'trials-table',
    rows: items,
    columns: TRIAL_COLUMNS,
    userId,
    exportSchema: TRIALS_EXPORT_SCHEMA,
    nonExportableColumnIds: ['actions'],
  });

  if (sortedRows.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        Filtreye uyan deneme kaydı bulunamadı. Aramayı temizleyebilir veya yeni
        deneme ekleyebilirsiniz.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Toolbar: sol sayım, sağda sütun kontrolü + export */}
      <div className="flex items-center justify-between px-1 md:px-0">
        <p className="text-[11px] text-slate-500">
          Toplam <span className="font-semibold">{sortedRows.length}</span>{' '}
          deneme kaydı var.
        </p>
        <div className="flex items-center gap-2">
          <TableColumnsControl
            columns={TRIAL_COLUMNS}
            isColumnVisible={isColumnVisible}
            toggleColumn={toggleColumn}
          />
          <TableExportButtons
            onExportCsv={handleExportCsv}
            onExportXlsx={handleExportXlsx}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {visibleColumns.map((col) => {
                const isSorted = prefsState.sortBy === col.id;
                const showSortIcon = col.sortable;

                let alignClass = 'text-left';
                if (col.id === 'actions') alignClass = 'text-right';

                return (
                  <th
                    key={col.id}
                    className={`px-4 py-2 font-medium text-slate-600 ${alignClass} ${
                      col.sortable ? 'cursor-pointer select-none' : ''
                    }`}
                    onClick={() => col.sortable && setSort(col.id)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {showSortIcon && isSorted && (
                        <span className="text-[10px]">
                          {prefsState.sortDir === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                {visibleColumns.map((col) => {
                  switch (col.id as TrialTableColumnId) {
                    case 'created_at':
                      return (
                        <td
                          key={col.id}
                          className="whitespace-nowrap px-4 py-2 text-slate-700"
                        >
                          {formatDate(t.created_at)}
                        </td>
                      );
                    case 'full_name':
                      return (
                        <td key={col.id} className="px-4 py-2 text-slate-800">
                          {t.full_name ?? '-'}
                        </td>
                      );
                    case 'phone':
                      return (
                        <td
                          key={col.id}
                          className="whitespace-nowrap px-4 py-2 text-slate-700"
                        >
                          {t.phone ?? '-'}
                        </td>
                      );
                    case 'first_meet_at':
                      return (
                        <td
                          key={col.id}
                          className="whitespace-nowrap px-4 py-2 text-slate-700"
                        >
                          {formatDate(t.first_meet_at)}
                        </td>
                      );
                    case 'next_meet_at':
                      return (
                        <td
                          key={col.id}
                          className="whitespace-nowrap px-4 py-2 text-slate-700"
                        >
                          {formatDate(t.next_meet_at)}
                        </td>
                      );
                    case 'reference':
                      return (
                        <td key={col.id} className="px-4 py-2 text-slate-700">
                          {t.reference_id ? 'Var' : 'Yok'}
                        </td>
                      );
                    case 'note':
                      return (
                        <td key={col.id} className="px-4 py-2 text-slate-700">
                          {t.note
                            ? t.note.length > 60
                              ? `${t.note.slice(0, 60)}…`
                              : t.note
                            : '-'}
                        </td>
                      );
                    case 'actions':
                      return (
                        <td
                          key={col.id}
                          className="whitespace-nowrap px-4 py-2 text-right"
                        >
                          <button
                            type="button"
                            onClick={() => onSelectRow(t)}
                            className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Detay
                          </button>
                        </td>
                      );
                    default:
                      return null;
                  }
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}






