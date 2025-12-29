// src/components/table/useTablePreferences.ts
// Summary: Manages per-table column visibility, sorting, and UI toggle preferences (with localStorage).
// Integrations:
// - Used by feature tables to persist column visibility, sorting, and optional UI toggles.
// - UI toggles live under state.ui (e.g., show/hide SoftDeleteModeFilter on page-level toolbars).
//
// Patch v2.3:
// - FIX: Make updates resilient when multiple components use the same tableId/userId storage key.
//        (Reads latest localStorage state before applying mutations, and listens to storage events.)
// - KEEP: state.ui support for table-level UI toggles.
// - KEEP: Preserve unknown saved column keys (do not wipe prefs if columns list changes).

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

function readLatestOrFallback(
  storageKey: string,
  fallback: TablePrefsState,
): TablePrefsState {
  if (typeof window === 'undefined') return fallback;
  return safeParsePrefs(localStorage.getItem(storageKey)) ?? fallback;
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

  // Keep in sync if another component/tab updates the same storage key.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      const next = loadInitialState(columns, storageKey);
      setState(next);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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
    setState((prev) => {
      // Read the latest to avoid overwriting concurrent updates
      const base = readLatestOrFallback(storageKey, prev);
      const currentValue =
        typeof base.columns?.[columnId] === 'boolean'
          ? base.columns[columnId]
          : true;

      return {
        ...base,
        columns: {
          ...(base.columns ?? {}),
          [columnId]: !currentValue,
        },
      };
    });
  };

  const setSort = (columnId: string) => {
    setState((prev) => {
      const base = readLatestOrFallback(storageKey, prev);

      if (base.sortBy !== columnId) {
        return {
          ...base,
          sortBy: columnId,
          sortDir: 'asc',
        };
      }

      const nextDir: SortDirection = base.sortDir === 'asc' ? 'desc' : 'asc';
      return {
        ...base,
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
      const base = readLatestOrFallback(storageKey, prev);
      const current = base.ui ?? {};
      const currentValue =
        typeof current[flagId] === 'boolean' ? current[flagId] : true;

      return {
        ...base,
        ui: {
          ...current,
          [flagId]: !currentValue,
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
