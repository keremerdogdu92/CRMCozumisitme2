// src/components/table/TableColumnsControl.tsx
// Small button that opens a checkbox list to toggle column visibility.

import { useState } from 'react';
import type { TableColumnDef } from './tableTypes';

type Props<TRow> = {
  columns: TableColumnDef<TRow>[];
  isColumnVisible: (id: string) => boolean;
  toggleColumn: (id: string) => void;
};

export function TableColumnsControl<TRow>({
  columns,
  isColumnVisible,
  toggleColumn,
}: Props<TRow>) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        onClick={() => setOpen((o) => !o)}
      >
        Sütunlar
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          <div className="max-h-64 space-y-1 overflow-auto">
            {columns.map((col) => (
              <label
                key={col.id}
                className="flex items-center gap-2 text-xs text-slate-700"
              >
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={isColumnVisible(col.id)}
                  onChange={() => toggleColumn(col.id)}
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
