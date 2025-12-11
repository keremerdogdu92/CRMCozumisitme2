// src/features/references/ReferencesTable.tsx
// Tabular list view for references with group, phone, commission and follow-up info.
// Supports column visibility toggles and client-side sorting.

import { useMemo } from 'react';
import type { ReferenceRow } from './types';
import { useTablePreferences } from '../../components/table/useTablePreferences';
import { TableColumnsControl } from '../../components/table/TableColumnsControl';
import type { TableColumnDef } from '../../components/table/tableTypes';

type ReferencesTableProps = {
  items: ReferenceRow[];
  onSelectRow: (ref: ReferenceRow) => void;
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
    return (r.commission_percent ?? 0) * 100; // yüzdelik değer
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

  const next = new Date(
    last.getTime() + r.contact_interval_days * MS_PER_DAY,
  );
  const today = new Date();
  const diffDays = Math.floor(
    (next.getTime() - today.getTime()) / MS_PER_DAY,
  );

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
 * Reminder için sıralama değeri:
 * - Plan yoksa +Infinity (en sona)
 * - last_meet_at yoksa da +Infinity
 * - Aksi halde "bir sonraki görüşme" tarihine göre timestamp
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
  const next = new Date(
    last.getTime() + r.contact_interval_days * MS_PER_DAY,
  );
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
}: ReferencesTableProps) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        Filtreye uyan referans bulunamadı. Aramayı temizleyebilir veya
        yeni referans ekleyebilirsiniz.
      </div>
    );
  }

  const {
    state: prefsState,
    visibleColumns,
    toggleColumn,
    setSort,
    isColumnVisible,
  } = useTablePreferences<ReferenceRow>(
    'references-table',
    REFERENCE_COLUMNS,
  );

  const sortedItems: ReferenceRow[] = useMemo(() => {
    if (!prefsState.sortBy) return items;

    const col = REFERENCE_COLUMNS.find(
      (c) => c.id === prefsState.sortBy,
    );
    if (!col || !col.sortable) return items;

    const accessor =
      col.accessor ??
      ((row: ReferenceRow) =>
        (row as any)[col.id as keyof ReferenceRow]);

    const result = [...items];

    result.sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);

      const aNull = va == null;
      const bNull = vb == null;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      // Tarih / sayı / string için basit karşılaştırma
      if (typeof va === 'number' && typeof vb === 'number') {
        if (va < vb) return prefsState.sortDir === 'asc' ? -1 : 1;
        if (va > vb) return prefsState.sortDir === 'asc' ? 1 : -1;
        return 0;
      }

      if (typeof va === 'string' && typeof vb === 'string') {
        // Tarih string’i olabilir; parse etmeyi deneriz
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

  return (
    <div className="space-y-2">
      {/* Üst bar: kayıt sayısı + sütun kontrolü */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">
          Toplam{' '}
          <span className="font-semibold">{items.length}</span> referans
          kaydı var.
        </p>
        <TableColumnsControl
          columns={REFERENCE_COLUMNS}
          isColumnVisible={isColumnVisible}
          toggleColumn={toggleColumn}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
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
              {/* İşlemler sütunu sabit, toggle dışı */}
              <th className="px-4 py-2 text-right font-medium text-slate-600">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((r) => {
              const reminder = computeReminderStatus(r);

              return (
                <tr key={r.id} className="border-t border-slate-100">
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
                          <td
                            key={col.id}
                            className="px-4 py-2 text-slate-800"
                          >
                            {r.full_name ?? '-'}
                          </td>
                        );
                      case 'group':
                        return (
                          <td
                            key={col.id}
                            className="px-4 py-2 text-slate-700"
                          >
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
                          <td
                            key={col.id}
                            className="whitespace-nowrap px-4 py-2"
                          >
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

                  {/* İşlemler */}
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectRow(r)}
                      className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Detay
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
