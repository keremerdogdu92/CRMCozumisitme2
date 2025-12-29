// src/features/references/ReferencesTable.tsx
// Summary: Tabular list view for references with responsive layout (mobile cards + desktop table).
// Integrations:
// - React Query: useQueryClient + useMutation for soft delete/restore.
// - Supabase RPCs via api.ts:
//   - softDeleteReference(id, reason?)
//   - restoreReference(id)
// - Table preferences: useTablePreferences (column visibility + sorting).
// - Shared UI: SoftDeleteRowActionButton for consistent delete/restore across modules.
//
// Patch v2.5.1 (2025-12-29):
// - CHANGE: Replace inline delete/restore buttons with SoftDeleteRowActionButton (shared component).
// - KEEP: Confirmation guard and optional delete reason prompt.
// - KEEP: Cache invalidation for all references queries after mutation.

import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReferenceRow } from './types';
import { useCurrentProfile } from '../auth/useCurrentProfile';
import { useTablePreferences } from '../../components/table/useTablePreferences';
import { TableColumnsControl } from '../../components/table/TableColumnsControl';
import type { TableColumnDef } from '../../components/table/tableTypes';
import { TableExportButtons } from '../../components/table/TableExportButtons';
import { exportToCsvFile, exportToXlsxFile } from '../../utils/csvUtils';
import { ResponsiveTableShell } from '../../components/layout/ResponsiveTableShell';
import { restoreReference, softDeleteReference } from './api';
import { SoftDeleteRowActionButton } from '../../components/softDelete/SoftDeleteRowActionButton';

type ReferencesTableProps = {
  items: ReferenceRow[];
  onSelectRow: (ref: ReferenceRow) => void;
  /**
   * Optional: if provided, the row with this ID will be visually highlighted.
   * Used when navigating from Meetings via focusId.
   */
  focusedId?: string | null;
};

type ReferenceTableColumnId =
  | 'created_at'
  | 'full_name'
  | 'group'
  | 'phone'
  | 'commission'
  | 'last_meet_at'
  | 'next_meet_at'
  | 'reminder'
  | 'status'
  | 'note';

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
}

function renderGroup(group: ReferenceRow['group']): string {
  switch (group) {
    case 'medikal':
      return 'Medikal';
    case 'doktor':
      return 'Doktor';
    case 'odyolog':
      return 'Odyolog';
    case 'dernek':
      return 'Dernek';
    default:
      return '-';
  }
}

function renderCommission(r: ReferenceRow): string {
  if (r.commission_scheme === 'percent') {
    const p = (r.commission_percent ?? 0) * 100;
    return p ? `% ${p.toFixed(1)}` : '% 0';
  }
  if (r.commission_scheme === 'fixed') {
    const v = r.commission_fixed ?? 0;
    return `${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL`;
  }
  return '-';
}

function getCommissionValue(r: ReferenceRow): number {
  if (r.commission_scheme === 'percent') {
    return (r.commission_percent ?? 0) * 100; // percentage value
  }
  if (r.commission_scheme === 'fixed') {
    return r.commission_fixed ?? 0;
  }
  return 0;
}

function renderStatus(r: ReferenceRow): string {
  return r.is_active ? 'Aktif' : 'Pasif';
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function computeReminderStatus(
  r: ReferenceRow,
): { label: string; className: string } {
  if (!r.contact_interval_days || r.contact_interval_days <= 0) {
    return { label: '-', className: 'text-slate-400' };
  }

  if (!r.last_meet_at) {
    return {
      label: 'Hiç görüşme yok',
      className: 'text-amber-600 font-medium',
    };
  }

  const last = new Date(r.last_meet_at);
  if (Number.isNaN(last.getTime())) {
    return { label: '-', className: 'text-slate-400' };
  }

  const next = new Date(last.getTime() + r.contact_interval_days * MS_PER_DAY);
  const today = new Date();
  const diffDays = Math.floor((next.getTime() - today.getTime()) / MS_PER_DAY);

  if (diffDays < 0) {
    return {
      label: `${Math.abs(diffDays)} gün gecikti`,
      className: 'text-red-600 font-medium',
    };
  }

  if (diffDays <= 7) {
    return {
      label: `${diffDays} gün içinde`,
      className: 'text-amber-600 font-medium',
    };
  }

  return {
    label: `${diffDays} gün sonra`,
    className: 'text-emerald-700',
  };
}

/**
 * Sort value for reminder:
 * - If no plan: +Infinity (goes to the end)
 * - If no last_meet_at: +Infinity
 * - Otherwise: timestamp of computed next follow-up date
 */
function getReminderSortValue(r: ReferenceRow): number {
  if (!r.contact_interval_days || r.contact_interval_days <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (!r.last_meet_at) {
    return Number.POSITIVE_INFINITY;
  }
  const last = new Date(r.last_meet_at);
  if (Number.isNaN(last.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  const next = new Date(last.getTime() + r.contact_interval_days * MS_PER_DAY);
  return next.getTime();
}

const REFERENCE_COLUMNS: TableColumnDef<
  ReferenceRow & { _colId?: ReferenceTableColumnId }
>[] = [
  {
    id: 'created_at',
    label: 'Kayıt',
    sortable: true,
    isDefaultVisible: true,
    accessor: (r) => r.created_at,
  },
  {
    id: 'full_name',
    label: 'Ad Soyad',
    sortable: true,
    isDefaultVisible: true,
    accessor: (r) => r.full_name ?? '',
  },
  {
    id: 'group',
    label: 'Grup',
    sortable: true,
    isDefaultVisible: true,
    accessor: (r) => r.group ?? '',
  },
  {
    id: 'phone',
    label: 'Telefon',
    sortable: true,
    isDefaultVisible: true,
    accessor: (r) => r.phone ?? '',
  },
  {
    id: 'commission',
    label: 'Varsayılan komisyon',
    sortable: true,
    isDefaultVisible: true,
    accessor: (r) => getCommissionValue(r),
  },
  {
    id: 'last_meet_at',
    label: 'Son Görüşme',
    sortable: true,
    isDefaultVisible: true,
    accessor: (r) => r.last_meet_at ?? '',
  },
  {
    id: 'next_meet_at',
    label: 'Sonraki Görüşme',
    sortable: true,
    isDefaultVisible: true,
    accessor: (r) => r.next_meet_at ?? '',
  },
  {
    id: 'reminder',
    label: 'Takip',
    sortable: true,
    isDefaultVisible: true,
    accessor: (r) => getReminderSortValue(r),
  },
  {
    id: 'status',
    label: 'Durum',
    sortable: true,
    isDefaultVisible: true,
    accessor: (r) => (r.is_active ? 1 : 0),
  },
  {
    id: 'note',
    label: 'Not',
    sortable: false,
    isDefaultVisible: true,
    accessor: (r) => r.note ?? '',
  },
];

export function ReferencesTable({
  items,
  onSelectRow,
  focusedId,
}: ReferencesTableProps) {
  const { data: profile } = useCurrentProfile();
  const userId = profile?.id ?? null;

  const queryClient = useQueryClient();

  const softDeleteMutation = useMutation({
    mutationFn: async (args: { id: string; reason: string | null }) => {
      await softDeleteReference(args.id, args.reason);
    },
    onSuccess: async () => {
      // Invalidate all references queries (active/deleted/all).
      await queryClient.invalidateQueries({ queryKey: ['references'] });
    },
    onError: (err) => {
      const msg =
        (err as Error | null | undefined)?.message ??
        'Silme sırasında hata oluştu.';
      console.error('Reference soft delete failed:', err);
      window.alert(msg);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      await restoreReference(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['references'] });
    },
    onError: (err) => {
      const msg =
        (err as Error | null | undefined)?.message ??
        'Geri alma sırasında hata oluştu.';
      console.error('Reference restore failed:', err);
      window.alert(msg);
    },
  });

  const {
    state: prefsState,
    visibleColumns,
    toggleColumn,
    setSort,
    isColumnVisible,
  } = useTablePreferences<ReferenceRow>(
    'references-table',
    REFERENCE_COLUMNS,
    userId,
  );

  const sortedItems: ReferenceRow[] = useMemo(() => {
    if (!prefsState.sortBy) return items;

    const col = REFERENCE_COLUMNS.find((c) => c.id === prefsState.sortBy);
    if (!col || !col.sortable) return items;

    const accessor =
      col.accessor ??
      ((row: ReferenceRow) => (row as any)[col.id as keyof ReferenceRow]);

    const result = [...items];

    result.sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);

      const aNull = va == null;
      const bNull = vb == null;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      if (typeof va === 'number' && typeof vb === 'number') {
        if (va < vb) return prefsState.sortDir === 'asc' ? -1 : 1;
        if (va > vb) return prefsState.sortDir === 'asc' ? 1 : -1;
        return 0;
      }

      if (typeof va === 'string' && typeof vb === 'string') {
        const ta = Date.parse(va);
        const tb = Date.parse(vb);
        if (!Number.isNaN(ta) && !Number.isNaN(tb)) {
          if (ta < tb) return prefsState.sortDir === 'asc' ? -1 : 1;
          if (ta > tb) return prefsState.sortDir === 'asc' ? 1 : -1;
          return 0;
        }

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

    return result;
  }, [items, prefsState.sortBy, prefsState.sortDir]);

  const handleExport = (type: 'csv' | 'xlsx') => {
    if (!sortedItems.length) return;

    const exportableColumns = visibleColumns;
    if (!exportableColumns.length) return;

    const headers = exportableColumns.map((col) => col.label);

    const rowsForExport = sortedItems.map((r) =>
      exportableColumns.map((col) => {
        switch (col.id as ReferenceTableColumnId) {
          case 'created_at':
            return r.created_at ?? '';
          case 'full_name':
            return r.full_name ?? '';
          case 'group':
            return renderGroup(r.group);
          case 'phone':
            return r.phone ?? '';
          case 'commission':
            return renderCommission(r);
          case 'last_meet_at':
            return r.last_meet_at ?? '';
          case 'next_meet_at':
            return r.next_meet_at ?? '';
          case 'reminder':
            return computeReminderStatus(r).label;
          case 'status':
            return renderStatus(r);
          case 'note':
            return r.note ?? '';
          default:
            return '';
        }
      }),
    );

    const baseFileName = 'references_export';

    if (type === 'csv') {
      exportToCsvFile({ fileName: baseFileName, headers, rows: rowsForExport });
    } else {
      exportToXlsxFile({
        fileName: baseFileName,
        headers,
        rows: rowsForExport,
      });
    }
  };

  const handleSoftDeleteClick = (r: ReferenceRow) => {
    if (!r.id) return;

    // Defensive guard: do not soft delete an already-deleted row.
    if (r.deleted_at) return;

    const ok = window.confirm(
      `${r.full_name ?? 'Bu referans'} kaydını silmek istiyor musun?\n\nBu işlem kalıcı silme değildir (soft delete).`,
    );
    if (!ok) return;

    // Optional reason (kept minimal to avoid introducing new UI components).
    const reasonRaw = window.prompt('Silme nedeni (opsiyonel):', '') ?? '';
    const reason = reasonRaw.trim().length > 0 ? reasonRaw.trim() : null;

    softDeleteMutation.mutate({ id: r.id, reason });
  };

  const handleRestoreClick = (r: ReferenceRow) => {
    if (!r.id) return;

    // Defensive guard: only restore if currently deleted.
    if (!r.deleted_at) return;

    const ok = window.confirm(
      `${r.full_name ?? 'Bu referans'} kaydını geri almak istiyor musun?`,
    );
    if (!ok) return;

    restoreMutation.mutate(r.id);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500 sm:text-sm">
        Filtreye uyan referans bulunamadı. Aramayı temizleyebilir veya yeni
        referans ekleyebilirsiniz.
      </div>
    );
  }

  const isMutating = softDeleteMutation.isPending || restoreMutation.isPending;

  return (
    <div className="space-y-3">
      {/* Top bar: count + column control + export */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-[11px] text-slate-500">
          Toplam{' '}
          <span className="font-semibold">{sortedItems.length}</span> referans
          kaydı var.
        </p>
        <div className="flex items-center justify-end gap-2">
          <TableColumnsControl
            columns={REFERENCE_COLUMNS}
            isColumnVisible={isColumnVisible}
            toggleColumn={toggleColumn}
          />
          <TableExportButtons
            onExportCsv={() => handleExport('csv')}
            onExportXlsx={() => handleExport('xlsx')}
          />
        </div>
      </div>

      {/* Mobile card list (md and below) */}
      <div className="space-y-3 md:hidden">
        {sortedItems.map((r) => {
          const reminder = computeReminderStatus(r);
          const isFocused = focusedId && r.id === focusedId;

          const noteText =
            r.note && r.note.length > 120 ? `${r.note.slice(0, 120)}…` : r.note ?? '';

          const isDeleted = !!r.deleted_at;

          return (
            <div
              key={r.id}
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
                    {r.full_name ?? '-'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Kayıt: {formatDate(r.created_at)}
                    {isDeleted ? ' · (Silinmiş)' : ''}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                  {renderGroup(r.group)}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Telefon
                  </span>
                  <span className="font-medium">
                    {r.phone && r.phone.trim().length > 0 ? r.phone : '-'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Durum
                  </span>
                  <span
                    className={
                      r.is_active
                        ? 'inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700'
                        : 'inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500'
                    }
                  >
                    {renderStatus(r)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Komisyon
                  </span>
                  <span className="font-medium">{renderCommission(r)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Takip
                  </span>
                  <span className={reminder.className}>{reminder.label}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Son Görüşme
                  </span>
                  <span className="font-medium">{formatDate(r.last_meet_at)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Sonraki Görüşme
                  </span>
                  <span className="font-medium">{formatDate(r.next_meet_at)}</span>
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

              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <SoftDeleteRowActionButton
                  isDeleted={isDeleted}
                  isBusy={isMutating}
                  size="xs"
                  onSoftDelete={() => handleSoftDeleteClick(r)}
                  onRestore={() => handleRestoreClick(r)}
                />

                <button
                  type="button"
                  onClick={() => onSelectRow(r)}
                  className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Detay
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop / tablet table (md and above) */}
      <ResponsiveTableShell className="hidden md:block">
        <table className="min-w-full text-xs md:text-sm">
          <thead className="bg-slate-50">
            <tr>
              {visibleColumns.map((col) => {
                const isSorted = prefsState.sortBy === col.id;
                const showSortIcon = col.sortable;

                let alignClass = 'text-left';
                if (col.id === 'commission') {
                  alignClass = 'text-right';
                }

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
              <th className="px-4 py-2 text-right font-medium text-slate-600">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((r) => {
              const reminder = computeReminderStatus(r);
              const isFocused = focusedId && r.id === focusedId;
              const isDeleted = !!r.deleted_at;

              return (
                <tr
                  key={r.id}
                  className={
                    'border-t border-slate-100 ' +
                    (isFocused ? 'bg-primary-50/70' : 'hover:bg-slate-50')
                  }
                >
                  {visibleColumns.map((col) => {
                    switch (col.id as ReferenceTableColumnId) {
                      case 'created_at':
                        return (
                          <td
                            key={col.id}
                            className="whitespace-nowrap px-4 py-2 text-slate-700"
                          >
                            {formatDate(r.created_at)}
                          </td>
                        );
                      case 'full_name':
                        return (
                          <td key={col.id} className="px-4 py-2 text-slate-800">
                            {r.full_name ?? '-'}
                          </td>
                        );
                      case 'group':
                        return (
                          <td key={col.id} className="px-4 py-2 text-slate-700">
                            {renderGroup(r.group)}
                          </td>
                        );
                      case 'phone':
                        return (
                          <td
                            key={col.id}
                            className="whitespace-nowrap px-4 py-2 text-slate-700"
                          >
                            {r.phone ?? '-'}
                          </td>
                        );
                      case 'commission':
                        return (
                          <td
                            key={col.id}
                            className="whitespace-nowrap px-4 py-2 text-right text-slate-700"
                          >
                            {renderCommission(r)}
                          </td>
                        );
                      case 'last_meet_at':
                        return (
                          <td
                            key={col.id}
                            className="whitespace-nowrap px-4 py-2 text-slate-700"
                          >
                            {formatDate(r.last_meet_at)}
                          </td>
                        );
                      case 'next_meet_at':
                        return (
                          <td
                            key={col.id}
                            className="whitespace-nowrap px-4 py-2 text-slate-700"
                          >
                            {formatDate(r.next_meet_at)}
                          </td>
                        );
                      case 'reminder':
                        return (
                          <td key={col.id} className="whitespace-nowrap px-4 py-2">
                            <span className={reminder.className}>
                              {reminder.label}
                            </span>
                          </td>
                        );
                      case 'status':
                        return (
                          <td
                            key={col.id}
                            className="whitespace-nowrap px-4 py-2 text-slate-700"
                          >
                            {renderStatus(r)}
                          </td>
                        );
                      case 'note': {
                        const text =
                          r.note && r.note.length > 120
                            ? `${r.note.slice(0, 120)}…`
                            : r.note ?? '-';
                        return (
                          <td
                            key={col.id}
                            className="max-w-xs truncate px-4 py-2 text-slate-500"
                          >
                            {text}
                          </td>
                        );
                      }
                      default:
                        return null;
                    }
                  })}

                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <SoftDeleteRowActionButton
                        isDeleted={isDeleted}
                        isBusy={isMutating}
                        size="sm"
                        onSoftDelete={() => handleSoftDeleteClick(r)}
                        onRestore={() => handleRestoreClick(r)}
                      />

                      <button
                        type="button"
                        onClick={() => onSelectRow(r)}
                        className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Detay
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ResponsiveTableShell>
    </div>
  );
}
