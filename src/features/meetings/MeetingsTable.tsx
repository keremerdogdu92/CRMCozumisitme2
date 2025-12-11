// src/features/meetings/MeetingsTable.tsx
// Meetings list table with meeting_type + subject info, filters,
// column visibility toggles and sorting.

import { useMemo, useState } from 'react';
import { useMeetingsQuery } from './api';
import type { MeetingRow, MeetingType } from './types';
import { useCurrentProfile } from '../auth/useCurrentProfile';
import { useTablePreferences } from '../../components/table/useTablePreferences';
import { TableColumnsControl } from '../../components/table/TableColumnsControl';
import type { TableColumnDef } from '../../components/table/tableTypes';

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
}

function formatMeetingType(type: MeetingType): string {
  switch (type) {
    case 'patient':
      return 'Hasta';
    case 'trial':
      return 'Deneme';
    case 'reference':
      return 'Referans';
    default:
      return 'Diğer';
  }
}

interface FilterButtonProps {
  label: string;
  value: MeetingType | 'all';
  current: MeetingType | 'all';
  onChange: (v: MeetingType | 'all') => void;
}

function FilterButton({ label, value, current, onChange }: FilterButtonProps) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`rounded-full px-3 py-1 text-xs font-medium border ${
        active
          ? 'bg-primary-50 border-primary-300 text-primary-700'
          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

type MeetingTableColumnId =
  | 'at'
  | 'meeting_type'
  | 'subject_name'
  | 'subject'
  | 'next_at'
  | 'satisfaction_10'
  | 'note';

const MEETING_COLUMNS: TableColumnDef<
  MeetingRow & { _colId?: MeetingTableColumnId }
>[] = [
  {
    id: 'at',
    label: 'Tarih',
    sortable: true,
    isDefaultVisible: true,
    accessor: (m) => m.at ?? null,
  },
  {
    id: 'meeting_type',
    label: 'Tip',
    sortable: true,
    isDefaultVisible: true,
    accessor: (m) => m.meeting_type,
  },
  {
    id: 'subject_name',
    label: 'Kişi',
    sortable: true,
    isDefaultVisible: true,
    accessor: (m) => m.subject_name ?? '',
  },
  {
    id: 'subject',
    label: 'Başlık',
    sortable: true,
    isDefaultVisible: true,
    accessor: (m) => m.subject ?? '',
  },
  {
    id: 'next_at',
    label: 'Sonraki Tarih',
    sortable: true,
    isDefaultVisible: true,
    accessor: (m) => m.next_at ?? null,
  },
  {
    id: 'satisfaction_10',
    label: 'Memnuniyet',
    sortable: true,
    isDefaultVisible: true,
    accessor: (m) => (m.satisfaction_10 ?? -1),
  },
  {
    id: 'note',
    label: 'Not',
    sortable: false,
    isDefaultVisible: true,
    accessor: (m) => m.note ?? '',
  },
];

export function MeetingsTable() {
  const { data, isLoading, isError, error } = useMeetingsQuery();
  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.role === 'admin';

  const [typeFilter, setTypeFilter] = useState<MeetingType | 'all'>('all');

  const {
    state: prefsState,
    visibleColumns,
    toggleColumn,
    setSort,
    isColumnVisible,
  } = useTablePreferences<MeetingRow>('meetings-table', MEETING_COLUMNS);

  if (isLoading) {
    return <p className="text-xs text-slate-500">Görüşmeler yükleniyor...</p>;
  }

  if (isError) {
    return (
      <p className="text-xs text-red-600">
        Görüşmeler yüklenirken hata oluştu:{' '}
        {(error as Error)?.message ?? 'Bilinmeyen hata'}
      </p>
    );
  }

  // Eski kayıtlar için default değerler atayıp MeetingRow tipine normalize et
  const rows: MeetingRow[] = (data ?? []).map((m) => {
    const meeting_type = (m.meeting_type ?? 'patient') as MeetingType;
    const subject_name = (m.subject_name ?? null) as string | null;
    const subject_id = (m.subject_id ?? null) as string | null;

    return {
      ...m,
      meeting_type,
      subject_name,
      subject_id,
    };
  });

  // Extra güvenlik: non-admin için referans görüşmelerini client-side da gizle
  const visibleRows: MeetingRow[] = isAdmin
    ? rows
    : rows.filter((m) => m.meeting_type !== 'reference');

  const filteredRows: MeetingRow[] =
    typeFilter === 'all'
      ? visibleRows
      : visibleRows.filter((m) => m.meeting_type === typeFilter);

  const sortedRows: MeetingRow[] = useMemo(() => {
    if (!prefsState.sortBy) return filteredRows;

    const col = MEETING_COLUMNS.find((c) => c.id === prefsState.sortBy);
    if (!col || !col.sortable) return filteredRows;

    const accessor =
      col.accessor ??
      ((row: MeetingRow) => (row as any)[col.id as keyof MeetingRow]);

    const result = [...filteredRows];
    result.sort((a, b) => {
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

    return result;
  }, [filteredRows, prefsState.sortBy, prefsState.sortDir]);

  if (visibleRows.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Henüz kayıtlı görüşme yok. Yukarıdan yeni bir görüşme ekleyebilirsiniz.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Filter bar + sütun kontrolü */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">
          Toplam <span className="font-semibold">{visibleRows.length}</span>{' '}
          görüşme kaydı var.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            <FilterButton
              label="Tümü"
              value="all"
              current={typeFilter}
              onChange={setTypeFilter}
            />
            <FilterButton
              label="Hastalar"
              value="patient"
              current={typeFilter}
              onChange={setTypeFilter}
            />
            <FilterButton
              label="Deneme hastaları"
              value="trial"
              current={typeFilter}
              onChange={setTypeFilter}
            />
            {isAdmin && (
              <FilterButton
                label="Referanslar"
                value="reference"
                current={typeFilter}
                onChange={setTypeFilter}
              />
            )}
          </div>
          <TableColumnsControl
            columns={MEETING_COLUMNS}
            isColumnVisible={isColumnVisible}
            toggleColumn={toggleColumn}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {visibleColumns.map((col) => {
                const isSorted = prefsState.sortBy === col.id;
                const showSortIcon = col.sortable;

                let alignClass = 'text-left';
                if (col.id === 'satisfaction_10') {
                  alignClass = 'text-center';
                }

                return (
                  <th
                    key={col.id}
                    className={`px-3 py-2 font-medium ${alignClass} ${
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
            {sortedRows.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                {visibleColumns.map((col) => {
                  switch (col.id as MeetingTableColumnId) {
                    case 'at':
                      return (
                        <td key={col.id} className="px-3 py-2 text-slate-800">
                          {formatDate(m.at)}
                        </td>
                      );
                    case 'meeting_type':
                      return (
                        <td key={col.id} className="px-3 py-2 text-slate-800">
                          {formatMeetingType(m.meeting_type)}
                        </td>
                      );
                    case 'subject_name':
                      return (
                        <td key={col.id} className="px-3 py-2 text-slate-800">
                          {m.subject_name ?? '-'}
                        </td>
                      );
                    case 'subject':
                      return (
                        <td key={col.id} className="px-3 py-2 text-slate-800">
                          {m.subject ?? '-'}
                        </td>
                      );
                    case 'next_at':
                      return (
                        <td key={col.id} className="px-3 py-2 text-slate-800">
                          {formatDate(m.next_at)}
                        </td>
                      );
                    case 'satisfaction_10':
                      return (
                        <td
                          key={col.id}
                          className="px-3 py-2 text-center text-slate-800"
                        >
                          {m.satisfaction_10 ?? '-'}
                        </td>
                      );
                    case 'note': {
                      const short =
                        m.note && m.note.length > 120
                          ? `${m.note.slice(0, 120)}…`
                          : m.note ?? '-';
                      return (
                        <td key={col.id} className="px-3 py-2 text-slate-600">
                          {short}
                        </td>
                      );
                    }
                    default:
                      return null;
                  }
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredRows.length === 0 && (
        <p className="text-[11px] text-slate-500">
          Bu filtreye uygun görüşme yok. Farklı bir filtre seçmeyi deneyin.
        </p>
      )}
    </div>
  );
}
