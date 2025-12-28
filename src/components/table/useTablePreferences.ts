// src/components/table/useTablePreferences.ts
// Summary: Manages per-table column visibility, sorting, and UI toggle preferences (with localStorage).
// Integrations:
// - Used by feature tables to persist column visibility and sorting.
// - Also supports UI toggles (e.g., show/hide SoftDeleteModeFilter) stored under state.ui.
//
// Patch v2.2:
// - ADD: state.ui to persist table-level UI toggles.
// - ADD: isUiFlagEnabled / toggleUiFlag helpers.
// - CHANGE: Preserve unknown saved column keys (do not wipe prefs if columns list is empty or changes).

import { useEffect, useMemo, useState } from 'react';
import type { SortDirection, TableColumnDef } from './tableTypes';

export type TablePrefsState = {
  columns: Record<string, boolean>; // columnId -> visible?
  sortBy: string | null;
  sortDir: SortDirection;
  ui?: Record<string, boolean>; // uiFlagId -> enabled?
};

const STORAGE_KEY_PREFIX = 'crm-table-prefs:';

function getStorageKey(tableId: string, userId?: string | null) {
  // If userId is provided, scope prefs per user + table.
  // Otherwise, fall back to table-only key (old behavior).
  return userId
    ? `${STORAGE_KEY_PREFIX}${tableId}:user:${userId}`
    : `${STORAGE_KEY_PREFIX}${tableId}`;
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

function buildDefaultColumns<TRow>(
  columns: TableColumnDef<TRow>[],
): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const col of columns) {
    defaults[col.id] = col.isDefaultVisible ?? true;
  }
  return defaults;
}

function loadInitialState<TRow>(
  columns: TableColumnDef<TRow>[],
  storageKey: string,
): TablePrefsState {
  const defaultColumns = buildDefaultColumns(columns);

  if (typeof window === 'undefined') {
    return {
      columns: defaultColumns,
      sortBy: null,
      sortDir: 'asc',
      ui: {},
    };
  }

  const saved = safeParsePrefs(localStorage.getItem(storageKey));
  if (!saved) {
    return {
      columns: defaultColumns,
      sortBy: null,
      sortDir: 'asc',
      ui: {},
    };
  }

  // Preserve all saved keys (even if current columns list differs),
  // then ensure defaults exist for any new columns.
  const mergedColumns: Record<string, boolean> = {
    ...(saved.columns ?? {}),
  };
  for (const key of Object.keys(defaultColumns)) {
    if (!(key in mergedColumns)) {
      mergedColumns[key] = defaultColumns[key];
    }
  }

  const mergedUi: Record<string, boolean> = {
    ...(saved.ui ?? {}),
  };

  return {
    columns: mergedColumns,
    sortBy: saved.sortBy ?? null,
    sortDir: saved.sortDir ?? 'asc',
    ui: mergedUi,
  };
}

export function useTablePreferences<TRow>(
  tableId: string,
  columns: TableColumnDef<TRow>[],
  userId?: string | null,
) {
  const storageKey = useMemo(
    () => getStorageKey(tableId, userId),
    [tableId, userId],
  );

  const [state, setState] = useState<TablePrefsState>(() =>
    loadInitialState(columns, storageKey),
  );

  // When storageKey (tableId/userId) or columns change, reload prefs.
  useEffect(() => {
    const nextState = loadInitialState(columns, storageKey);
    setState(nextState);
  }, [columns, storageKey]);

  // Persist state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [storageKey, state]);

  const visibleColumns = useMemo(
    () => columns.filter((c) => state.columns[c.id] !== false),
    [columns, state.columns],
  );

  const toggleColumn = (columnId: string) => {
    setState((prev) => ({
      ...prev,
      columns: {
        ...prev.columns,
        [columnId]: !(prev.columns[columnId] !== false),
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
      const nextDir: SortDirection = prev.sortDir === 'asc' ? 'desc' : 'asc';
      return {
        ...prev,
        sortBy: columnId,
        sortDir: nextDir,
      };
    });
  };

  const isColumnVisible = (id: string) => state.columns[id] !== false;

  const isUiFlagEnabled = (flagId: string, defaultValue = true) => {
    const ui = state.ui ?? {};
    const v = ui[flagId];
    return typeof v === 'boolean' ? v : defaultValue;
  };

  const toggleUiFlag = (flagId: string) => {
    setState((prev) => {
      const current = prev.ui ?? {};
      const nextValue = !(typeof current[flagId] === 'boolean' ? current[flagId] : true);

      return {
        ...prev,
        ui: {
          ...current,
          [flagId]: nextValue,
        },
      };
    });
  };

  return {
    state,
    visibleColumns,
    toggleColumn,
    setSort,
    isColumnVisible,
    // UI toggles
    isUiFlagEnabled,
    toggleUiFlag,
  };
}
