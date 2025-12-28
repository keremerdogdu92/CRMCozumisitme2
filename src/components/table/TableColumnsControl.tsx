// src/components/table/TableColumnsControl.tsx
// Summary: Small button + dropdown with checkboxes to toggle column visibility.
// Integrations:
// - Uses table preferences (caller-provided isColumnVisible/toggleColumn).
// - Also supports optional "UI toggles" that are not columns (e.g., filter show/hide).
//
// IMPORTANT:
// - This component does not own persistence; caller should pass handlers from useTablePreferences.

import { useState } from 'react';
import type { TableColumnDef } from './tableTypes';

export type TableUiToggleDef = {
  id: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
};

type Props<TRow> = {
  columns: TableColumnDef<TRow>[];
  isColumnVisible: (id: string) => boolean;
  toggleColumn: (id: string) => void;

  /**
   * Optional: additional toggles for table UI elements
   * that are not actual columns (e.g. filter visibility).
   */
  uiToggles?: TableUiToggleDef[];
};

export function TableColumnsControl<TRow>({
  columns,
  isColumnVisible,
  toggleColumn,
  uiToggles,
}: Props<TRow>) {
  const [open, setOpen] = useState(false);

  const effectiveUiToggles = uiToggles ?? [];
  const hasUiSection = effectiveUiToggles.length > 0;

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
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          {hasUiSection && (
            <>
              <div className="mb-2">
                <div className="px-1 pb-1 text-[11px] font-medium text-slate-500">
                  Görünüm
                </div>
                <div className="space-y-1">
                  {effectiveUiToggles.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={t.checked}
                        onChange={t.onToggle}
                      />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="my-2 h-px bg-slate-100" />
            </>
          )}

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
