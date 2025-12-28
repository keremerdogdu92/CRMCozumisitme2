// src/components/table/SoftDeleteModeFilter.tsx
// Summary: Reusable soft-delete visibility filter UI for table pages.
// Usage:
// - Bind value + onChange at page-level.
// - Visibility can be controlled by table preferences (e.g., show/hide toggle in Columns menu).

import type { SoftDeleteMode } from '../../utils/softDelete/softDeleteTypes';
import { SOFT_DELETE_MODE_OPTIONS } from '../../utils/softDelete/softDeleteTypes';

type SoftDeleteModeFilterProps = {
  value: SoftDeleteMode;
  onChange: (value: SoftDeleteMode) => void;
  className?: string;
};

export function SoftDeleteModeFilter({
  value,
  onChange,
  className,
}: SoftDeleteModeFilterProps) {
  return (
    <div className={'flex items-center gap-2 ' + (className ?? '')}>
      <span className="text-[11px] text-slate-500 sm:text-xs">Silinenler:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SoftDeleteMode)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        {SOFT_DELETE_MODE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
