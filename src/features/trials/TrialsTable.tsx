// src/features/trials/TrialsTable.tsx
// Tabular list view for trial rows with column visibility toggles and sorting.

import { useMemo } from 'react';
import type { TrialRow } from './types';
import { useTablePreferences } from '../../components/table/useTablePreferences';
import { TableColumnsControl } from '../../components/table/TableColumnsControl';
import type { TableColumnDef } from '../../components/table/tableTypes';

type TrialsTableProps = {
  items: TrialRow[];
  onSelectRow: (trial: TrialRow) => void;
};

type TrialTableColumnId =
  | 'created_at'
  | 'full_name'
  | 'phone'
  | 'first_meet_at'
  | 'next_meet_at'
  | 'reference'
  | 'note'
  | 'actions';

const TRIAL_COLUMNS: TableColumnDef<TrialRow & { _colId?: TrialTableColumnId }>[] =
  [
    {
      id: 'created_at',
      label: 'Kayıt',
      sortable: true,
      isDefaultVisible: true,
      accessor: (t) => t.created_at ?? null,
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

export function TrialsTable({ items, onSelectRow }: TrialsTableProps) {
  const {
    state: prefsState,
    visibleColumns,
    toggleColumn,
    setSort,
    isColumnVisible,
  } = useTablePreferences<TrialRow>('trials-table', TRIAL_COLUMNS);

  const sortedItems = useMemo(() => {
    if (!prefsState.sortBy) return items;

    const col = TRIAL_COLUMNS.find((c) => c.id === prefsState.sortBy);
    if (!col || !col.sortable) return items;

    const accessor =
      col.accessor ?? ((row: TrialRow) => (row as any)[col.id as keyof TrialRow]);

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

  if (sortedItems.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        Filtreye uyan deneme kaydı bulunamadı. Aramayı temizleyebilir veya yeni deneme
        ekleyebilirsiniz.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      {/* Toolbar: sağ üstte sütun kontrolü */}
      <div className="flex items-center justify-end px-4 py-2">
        <TableColumnsControl
          columns={TRIAL_COLUMNS}
          isColumnVisible={isColumnVisible}
          toggleColumn={toggleColumn}
        />
      </div>

      <table className="min-w-full text-sm">
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
          {sortedItems.map((t) => (
            <tr key={t.id} className="border-t border-slate-100">
              {visibleColumns.map((col) => {
                switch (col.id as TrialTableColumnId) {
                  case 'created_at':
                    return (
                      <td
                        key={col.id}
                        className="px-4 py-2 text-slate-700 whitespace-nowrap"
                      >
                        {formatDate(t.created_at)}
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
                        className="px-4 py-2 text-slate-700 whitespace-nowrap"
                      >
                        {t.phone ?? '-'}
                      </td>
                    );
                  case 'first_meet_at':
                    return (
                      <td
                        key={col.id}
                        className="px-4 py-2 text-slate-700 whitespace-nowrap"
                      >
                        {formatDate(t.first_meet_at)}
                      </td>
                    );
                  case 'next_meet_at':
                    return (
                      <td
                        key={col.id}
                        className="px-4 py-2 text-slate-700 whitespace-nowrap"
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
                        className="px-4 py-2 text-right whitespace-nowrap"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectRow(t)}
                          className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Detay
                        </button>
                      </td>
                    );
                  default:
                    return null;
                }
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
