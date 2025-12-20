// src/components/table/TableExportButtons.tsx
// Small paired buttons for exporting table data as CSV / XLSX.
// Intended to be placed next to TableColumnsControl in table toolbars.

import type { MouseEventHandler } from 'react';

type TableExportButtonsProps = {
  onExportCsv: MouseEventHandler<HTMLButtonElement>;
  onExportXlsx: MouseEventHandler<HTMLButtonElement>;
};

export function TableExportButtons({
  onExportCsv,
  onExportXlsx,
}: TableExportButtonsProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onExportCsv}
        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        CSV
      </button>
      <button
        type="button"
        onClick={onExportXlsx}
        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        Excel
      </button>
    </div>
  );
}
