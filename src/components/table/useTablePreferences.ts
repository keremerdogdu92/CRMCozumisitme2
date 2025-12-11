// src/components/table/useTablePreferences.ts
// Keeps per-table column visibility and sorting preferences in localStorage.

import { useEffect, useMemo, useState } from 'react';
import type { SortDirection, TableColumnDef } from './tableTypes';

export type TablePrefsState = {
  columns: Record<string, boolean>; // columnId -> visible?
  sortBy: string | null;
  sortDir: SortDirection;
};

const STORAGE_KEY_PREFIX = 'crm-table-prefs:';

function getStorageKey(tableId: string) {
  return `${STORAGE_KEY_PREFIX}${tableId}`;
}

function safeParsePrefs(json: string | null): TablePrefsState | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as TablePrefsState;
  } catch {
    return null;
  }
}

export function useTablePreferences<TRow>(
  tableId: string,
  columns: TableColumnDef<TRow>[],
) {
  const [state, setState] = useState<TablePrefsState>(() => {
    // default state
    const defaultColumns: Record<string, boolean> = {};
    for (const col of columns) {
      defaultColumns[col.id] = col.isDefaultVisible ?? true;
    }

    if (typeof window === 'undefined') {
      return {
        columns: defaultColumns,
        sortBy: null,
        sortDir: 'asc',
      };
    }

    const saved = safeParsePrefs(localStorage.getItem(getStorageKey(tableId)));
    if (!saved) {
      return {
        columns: defaultColumns,
        sortBy: null,
        sortDir: 'asc',
      };
    }

    // Kolon listesi değişmişse (yeni kolon ekledin vs.) default’larla merge et
    const mergedColumns: Record<string, boolean> = { ...defaultColumns };
    for (const key of Object.keys(saved.columns ?? {})) {
      if (key in mergedColumns) {
        mergedColumns[key] = saved.columns[key];
      }
    }

    return {
      columns: mergedColumns,
      sortBy: saved.sortBy ?? null,
      sortDir: saved.sortDir ?? 'asc',
    };
  });

  // LocalStorage sync
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getStorageKey(tableId), JSON.stringify(state));
  }, [tableId, state]);

  // Public API
  const visibleColumns = useMemo(
    () => columns.filter((c) => state.columns[c.id] !== false),
    [columns, state.columns],
  );

  const toggleColumn = (columnId: string) => {
    setState((prev) => ({
      ...prev,
      columns: {
        ...prev.columns,
        [columnId]: !prev.columns[columnId],
      },
    }));
  };

  const setSort = (columnId: string) => {
    setState((prev) => {
      if (prev.sortBy !== columnId) {
        return {
          ...prev,
          sortBy: columnId,
          sortDir: 'asc',
        };
      }
      // Aynı kolona tıklayınca yön değişsin
      const nextDir: SortDirection = prev.sortDir === 'asc' ? 'desc' : 'asc';
      return {
        ...prev,
        sortBy: columnId,
        sortDir: nextDir,
      };
    });
  };

  return {
    state,
    visibleColumns,
    toggleColumn,
    setSort,
    isColumnVisible: (id: string) => state.columns[id] !== false,
  };
}
