// src/features/trials/TrialsTable.tsx
// Summary: Tabular and mobile-card list view for trial lead pipeline rows.
// Integrations:
// - Uses useTablePreferences(userId) for per-user visible columns and sorting.
// - Supports export (CSV/XLSX) via shared helpers.
// - Supports focusedId highlighting for deep-links.
// - Supports soft delete / restore via RPC wrappers in ./api.ts (soft_delete_trials, restore_trials).
//   * Invalidates TRIALS_QUERY_KEY on success.
//
// Patch v2.7 (soft delete actions):
// - ADD: Row-level soft delete / restore buttons in "İşlemler" column (desktop + mobile cards).
// - Uses confirm() + optional prompt() for delete reason (sent to RPC as p_reason).
// - Export continues to exclude "İşlemler" column.

import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TrialRow, TrialStatus } from './types';
import { useTablePreferences } from '../../components/table/useTablePreferences';
import { TableColumnsControl } from '../../components/table/TableColumnsControl';
import type { TableColumnDef } from '../../components/table/tableTypes';
import { useCurrentProfile } from '../auth/useCurrentProfile';
import { TableExportButtons } from '../../components/table/TableExportButtons';
import { exportToCsvFile, exportToXlsxFile } from '../../utils/csvUtils';
import { ResponsiveTableShell } from '../../components/layout/ResponsiveTableShell';
import { TRIALS_QUERY_KEY, softDeleteTrial, restoreTrial } from './api';

type TrialsTableProps = {
  items: TrialRow[];
  onSelectRow: (trial: TrialRow) => void;
  /**
   * Optional: if provided, the row with this ID will be visually highlighted.
   * Used when navigating from Meetings via focusId.
   */
  focusedId?: string | null;

  /**
   * Optional slot to attach extra toolbar content on the right (before columns/export).
   * Example: SoftDeleteModeFilter shown only for admins.
   */
  toolbarRight?: ReactNode;
};

type TrialTableColumnId =
  | 'created_at'
  | 'status'
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
    id: 'status',
    label: 'Durum',
    sortable: true,
    isDefaultVisible: true,
    accessor: (t) => t.status ?? 'active',
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

function getStatusLabel(status: TrialStatus): string {
  if (status === 'converted') return 'Dönüştü';
  if (status === 'lost') return 'Kaybedildi';
  return 'Aktif';
}

function getStatusBadgeClass(status: TrialStatus): string {
  if (status === 'converted') {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (status === 'lost') {
    return 'bg-rose-50 text-rose-700';
  }
  return 'bg-slate-50 text-slate-600';
}

export function TrialsTable({
  items,
  onSelectRow,
  focusedId,
  toolbarRight,
}: TrialsTableProps) {
  const { data: profile } = useCurrentProfile();
  const userId = profile?.id ?? null;

  const queryClient = useQueryClient();

  const [pendingRowId, setPendingRowId] = useState<string | null>(null);

  const softDeleteMutation = useMutation<void, Error, { id: string; reason: string | null }>({
    mutationFn: async ({ id, reason }) => {
      setPendingRowId(id);
      try {
        await softDeleteTrial(id, reason);
      } finally {
        setPendingRowId((prev) => (prev === id ? null : prev));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIALS_QUERY_KEY });
    },
  });

  const restoreMutation = useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      setPendingRowId(id);
      try {
        await restoreTrial(id);
      } finally {
        setPendingRowId((prev) => (prev === id ? null : prev));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIALS_QUERY_KEY });
    },
  });

  const {
    state: prefsState,
    visibleColumns,
    toggleColumn,
    setSort,
    isColumnVisible,
  } = useTablePreferences<TrialRow>('trials-table', TRIAL_COLUMNS, userId);

  const sortedItems = useMemo(() => {
    if (!prefsState.sortBy) return items;

    const col = TRIAL_COLUMNS.find((c) => c.id === prefsState.sortBy);
    if (!col || !col.sortable) return items;

    const accessor =
      col.accessor ??
      ((row: TrialRow) => (row as any)[col.id as keyof TrialRow]);

    const sorted = [...items];
    sorted.sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);

      const aNull = va == null;
      const bNull = vb == null;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      if (typeof va === 'string' && typeof vb === 'string') {
        const aTime = Date.parse(va);
        const bTime = Date.parse(vb);
        if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) {
          if (aTime < bTime) return prefsState.sortDir === 'asc' ? -1 : 1;
          if (aTime > bTime) return prefsState.sortDir === 'asc' ? 1 : -1;
          return 0;
        }
        if (va < vb) return prefsState.sortDir === 'asc' ? -1 : 1;
        if (va > vb) return prefsState.sortDir === 'asc' ? 1 : -1;
        return 0;
      }

      if (typeof va === 'number' && typeof vb === 'number') {
        if (va < vb) return prefsState.sortDir === 'asc' ? -1 : 1;
        if (va > vb) return prefsState.sortDir === 'asc' ? 1 : -1;
        return 0;
      }

      const av = va as any;
      const bv = vb as any;
      if (av < bv) return prefsState.sortDir === 'asc' ? -1 : 1;
      if (av > bv) return prefsState.sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [items, prefsState.sortBy, prefsState.sortDir]);

  const handleExport = (type: 'csv' | 'xlsx') => {
    if (!sortedItems.length) return;

    // Export intentionally excludes row actions.
    const exportableColumns = visibleColumns.filter((c) => c.id !== 'actions');
    if (!exportableColumns.length) return;

    const headers = exportableColumns.map((col) => col.label);

    const rowsForExport = sortedItems.map((t) =>
      exportableColumns.map((col) => {
        switch (col.id as TrialTableColumnId) {
          case 'created_at':
            return formatShortDate(t.created_at);
          case 'status':
            return getStatusLabel(t.status);
          case 'full_name':
            return t.full_name ?? '';
          case 'phone':
            return t.phone ?? '';
          case 'first_meet_at':
            return formatShortDate(t.first_meet_at);
          case 'next_meet_at':
            return formatShortDate(t.next_meet_at);
          case 'reference':
            return t.reference_id ? 'Var' : 'Yok';
          case 'note':
            return t.note ?? '';
          default:
            return '';
        }
      }),
    );

    const baseFileName = 'trials_export';

    if (type === 'csv') {
      exportToCsvFile({
        fileName: baseFileName,
        headers,
        rows: rowsForExport,
      });
    } else {
      exportToXlsxFile({
        fileName: baseFileName,
        headers,
        rows: rowsForExport,
      });
    }
  };

  const handleSoftDeleteClick = (trial: TrialRow) => {
    if (!trial?.id) return;

    const ok = window.confirm('Bu deneme kaydını silmek (soft delete) istiyor musunuz?');
    if (!ok) return;

    // Optional reason prompt; empty input is treated as null.
    const reasonRaw = window.prompt('Silme nedeni (opsiyonel):', '');
    const reason = (reasonRaw ?? '').trim();
    softDeleteMutation.mutate({ id: trial.id, reason: reason.length ? reason : null });
  };

  const handleRestoreClick = (trial: TrialRow) => {
    if (!trial?.id) return;

    const ok = window.confirm('Bu deneme kaydını geri getirmek istiyor musunuz?');
    if (!ok) return;

    restoreMutation.mutate({ id: trial.id });
  };

  if (sortedItems.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500 sm:text-sm">
        Filtreye uyan deneme kaydı bulunamadı. Aramayı temizleyebilir veya yeni
        deneme ekleyebilirsiniz.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: left count; right: optional slot + columns + export */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-slate-500">
          Toplam <span className="font-semibold">{sortedItems.length}</span>{' '}
          deneme kaydı var.
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {toolbarRight}
          <TableColumnsControl
            columns={TRIAL_COLUMNS}
            isColumnVisible={isColumnVisible}
            toggleColumn={toggleColumn}
          />
          <TableExportButtons
            onExportCsv={() => handleExport('csv')}
            onExportXlsx={() => handleExport('xlsx')}
          />
        </div>
      </div>

      {/* Mobile: card list (md and down) */}
      <div className="space-y-3 md:hidden">
        {sortedItems.map((t) => {
          const isFocused = focusedId && t.id === focusedId;
          const isDeleted = (t.deleted_at ?? null) != null;
          const isBusy =
            pendingRowId === t.id ||
            softDeleteMutation.isPending ||
            restoreMutation.isPending;

          const noteText =
            t.note && t.note.length > 100 ? `${t.note.slice(0, 100)}…` : t.note ?? '';

          return (
            <div
              key={t.id}
              className={
                'rounded-lg border px-3 py-3 shadow-sm ' +
                (isFocused
                  ? 'border-primary-300 bg-primary-50/70'
                  : 'border-slate-200 bg-white')
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {t.full_name ?? '-'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Kayıt: {formatShortDate(t.created_at)}
                    {isDeleted ? ' · (Silinmiş)' : ''}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                      getStatusBadgeClass(t.status)
                    }
                  >
                    {getStatusLabel(t.status)}
                  </span>

                  {t.reference_id ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      Referanslı
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      Referans yok
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Telefon
                  </span>
                  <span className="font-medium">
                    {t.phone && t.phone.trim().length > 0 ? t.phone : '-'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    İlk görüşme
                  </span>
                  <span className="font-medium">{formatShortDate(t.first_meet_at)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Sonraki randevu
                  </span>
                  <span className="font-medium">{formatShortDate(t.next_meet_at)}</span>
                </div>
              </div>

              {noteText && (
                <div className="mt-2">
                  <span className="block text-[10px] uppercase text-slate-400">
                    Not
                  </span>
                  <span className="text-[11px] text-slate-600">{noteText}</span>
                </div>
              )}

              <div className="mt-3 flex items-center justify-end gap-2">
                {isDeleted ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleRestoreClick(t)}
                    className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Silinmiş kaydı geri getir"
                  >
                    Geri getir
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleSoftDeleteClick(t)}
                    className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Kayıt soft delete yapılır"
                  >
                    Sil
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onSelectRow(t)}
                  className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Detay
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop / tablet: classic table (md and up) */}
      <ResponsiveTableShell className="hidden md:block">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-xs md:text-sm">
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
              {sortedItems.map((t) => {
                const isFocused = focusedId && t.id === focusedId;
                const isDeleted = (t.deleted_at ?? null) != null;
                const isBusy =
                  pendingRowId === t.id ||
                  softDeleteMutation.isPending ||
                  restoreMutation.isPending;

                return (
                  <tr
                    key={t.id}
                    className={
                      'border-t border-slate-100 ' +
                      (isFocused ? 'bg-primary-50/70' : 'hover:bg-slate-50')
                    }
                  >
                    {visibleColumns.map((col) => {
                      switch (col.id as TrialTableColumnId) {
                        case 'created_at':
                          return (
                            <td
                              key={col.id}
                              className="whitespace-nowrap px-4 py-2 text-slate-700"
                            >
                              {formatDate(t.created_at)}
                              {isDeleted ? (
                                <span className="ml-2 text-[11px] text-rose-700">
                                  (Silinmiş)
                                </span>
                              ) : null}
                            </td>
                          );
                        case 'status':
                          return (
                            <td key={col.id} className="px-4 py-2">
                              <span
                                className={
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                                  getStatusBadgeClass(t.status)
                                }
                              >
                                {getStatusLabel(t.status)}
                              </span>
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
                              <div className="inline-flex items-center gap-2">
                                {isDeleted ? (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleRestoreClick(t)}
                                    className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    title="Silinmiş kaydı geri getir"
                                  >
                                    Geri getir
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleSoftDeleteClick(t)}
                                    className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    title="Kayıt soft delete yapılır"
                                  >
                                    Sil
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => onSelectRow(t)}
                                  className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Detay
                                </button>
                              </div>
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ResponsiveTableShell>
    </div>
  );
}
