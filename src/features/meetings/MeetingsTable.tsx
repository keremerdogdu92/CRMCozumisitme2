// src/features/meetings/MeetingsTable.tsx
// Meetings list table with meeting_type + subject info, filters,
// column visibility toggles, sorting and export (CSV / Excel).
//
// Patch v2.3:
// - ADD: "İşlemler" kolonu.
// - ADD: Satır bazlı "Hastaya git / Denemeye git / Referansa git" navigasyon butonu.
//   * meeting_type + subject_id'ye göre ilgili sayfaya ?focusId=<uuid> ile yönlendirir.
// - Export'ta "İşlemler" kolonu hariç tutulur.
//
// Patch v2.2:
// - ADD: Export buttons (CSV + XLSX) using visible columns + filtered + sorted rows.
// - Uses shared csvUtils + TableExportButtons component.
// - Keeps hook order stable (no new hooks added).
//
// Patch v2.1:
// - FIX (critical): Prevents React error #310 by ensuring hooks are called in a stable order.
//   * `useMemo` (sortedRows) is now executed on every render (even while loading/error).
//   * Avoids returning early before all hooks are called.
// - No behavior change intended for normal UI flow.
//
// Patch v2.4 (responsive polish):
// - ADD: Mobile card view (md altı) → telefon ekranında okunabilirlik arttı.
// - Desktop/tablet tablosu ResponsiveTableShell içine alındı.
// - Filter bar mobile-first hale getirildi (wrap + dikey stack).

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMeetingsQuery } from './api';
import type { MeetingRow, MeetingType } from './types';
import { useCurrentProfile } from '../auth/useCurrentProfile';
import { useTablePreferences } from '../../components/table/useTablePreferences';
import { TableColumnsControl } from '../../components/table/TableColumnsControl';
import type { TableColumnDef } from '../../components/table/tableTypes';
import {
  exportToCsvFile,
  exportToXlsxFile,
} from '../../utils/csvUtils';
import { TableExportButtons } from '../../components/table/TableExportButtons';
import { ResponsiveTableShell } from '../../components/layout/ResponsiveTableShell';

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
  | 'note'
  | 'actions';

const MEETING_COLUMNS: TableColumnDef<
  MeetingRow & { _colId?: MeetingTableColumnId }
>[] = [
  {
    id: 'at',
    label: 'Tarih',
    sortable: true,
    isDefaultVisible: true,
    accessor: (m) => m.at ?? null,
    exportAccessor: (m) => m.at ?? null,
  },
  {
    id: 'meeting_type',
    label: 'Tip',
    sortable: true,
    isDefaultVisible: true,
    accessor: (m) => m.meeting_type,
    exportAccessor: (m) => formatMeetingType(m.meeting_type),
  },
  {
    id: 'subject_name',
    label: 'Kişi',
    sortable: true,
    isDefaultVisible: true,
    accessor: (m) => m.subject_name ?? '',
    exportAccessor: (m) => m.subject_name ?? '',
  },
  {
    id: 'subject',
    label: 'Başlık',
    sortable: true,
    isDefaultVisible: true,
    accessor: (m) => m.subject ?? '',
    exportAccessor: (m) => m.subject ?? '',
  },
  {
    id: 'next_at',
    label: 'Sonraki Tarih',
    sortable: true,
    isDefaultVisible: true,
    accessor: (m) => m.next_at ?? null,
    exportAccessor: (m) => m.next_at ?? null,
  },
  {
    id: 'satisfaction_10',
    label: 'Memnuniyet',
    sortable: true,
    isDefaultVisible: true,
    accessor: (m) => m.satisfaction_10 ?? -1,
    exportAccessor: (m) => m.satisfaction_10 ?? null,
  },
  {
    id: 'note',
    label: 'Not',
    sortable: false,
    isDefaultVisible: true,
    accessor: (m) => m.note ?? '',
    exportAccessor: (m) => m.note ?? '',
  },
  {
    id: 'actions',
    label: 'İşlemler',
    sortable: false,
    isDefaultVisible: true,
  },
];

export function MeetingsTable() {
  const { data, isLoading, isError, error } = useMeetingsQuery();
  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.role === 'admin';
  const userId = profile?.id ?? null;
  const navigate = useNavigate();

  const [typeFilter, setTypeFilter] = useState<MeetingType | 'all'>('all');

  const {
    state: prefsState,
    visibleColumns,
    toggleColumn,
    setSort,
    isColumnVisible,
  } = useTablePreferences<MeetingRow>(
    'meetings-table',
    MEETING_COLUMNS,
    userId,
  );

  // NOTE: Even during loading/error, we compute with safe defaults so hooks remain stable.
  const safeData: MeetingRow[] = (data ?? []) as MeetingRow[];

  // Eski kayıtlar için default değerler atayıp MeetingRow tipine normalize et
  const rows: MeetingRow[] = safeData.map((m) => {
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

  const handleExport = (type: 'csv' | 'xlsx') => {
    if (sortedRows.length === 0) return;

    // "İşlemler" kolonunu export'a dahil etmiyoruz
    const exportableColumns = visibleColumns.filter(
      (col) => col.id !== 'actions',
    );

    if (exportableColumns.length === 0) return;

    const headers = exportableColumns.map(
      (col) => col.exportLabel ?? col.label,
    );

    const rowsForExport = sortedRows.map((m) =>
      exportableColumns.map((col) => {
        const id = col.id as MeetingTableColumnId;

        if (col.exportAccessor) {
          return col.exportAccessor(m as any);
        }

        switch (id) {
          case 'at':
            return m.at ?? null;
          case 'meeting_type':
            return formatMeetingType(m.meeting_type);
          case 'subject_name':
            return m.subject_name ?? '';
          case 'subject':
            return m.subject ?? '';
          case 'next_at':
            return m.next_at ?? null;
          case 'satisfaction_10':
            return m.satisfaction_10 ?? null;
          case 'note':
            return m.note ?? '';
          default:
            return '';
        }
      }),
    );

    const baseFileName = 'meetings_export';

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

  // After all hooks are called, it is safe to early-return.
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

  if (visibleRows.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Henüz kayıtlı görüşme yok. Yukarıdan yeni bir görüşme ekleyebilirsiniz.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter bar + sütun kontrolü + export butonları */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-[11px] text-slate-500">
          Toplam <span className="font-semibold">{visibleRows.length}</span>{' '}
          görüşme kaydı var.
        </p>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
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
          <div className="flex items-center justify-end gap-2">
            <TableColumnsControl
              columns={MEETING_COLUMNS}
              isColumnVisible={isColumnVisible}
              toggleColumn={toggleColumn}
            />
            <TableExportButtons
              onExportCsv={() => handleExport('csv')}
              onExportXlsx={() => handleExport('xlsx')}
            />
          </div>
        </div>
      </div>

      {/* Mobile: card list (md altı) */}
      <div className="space-y-3 md:hidden">
        {sortedRows.map((m) => {
          const typeLabel = formatMeetingType(m.meeting_type);
          const satisfactionDisplay =
            m.satisfaction_10 != null ? `${m.satisfaction_10} / 10` : '-';

          let actionLabel = '';
          let path = '';
          if (m.subject_id) {
            switch (m.meeting_type) {
              case 'patient':
                actionLabel = 'Hastaya git';
                path = `/patients?focusId=${encodeURIComponent(m.subject_id)}`;
                break;
              case 'trial':
                actionLabel = 'Denemeye git';
                path = `/trials?focusId=${encodeURIComponent(m.subject_id)}`;
                break;
              case 'reference':
                actionLabel = 'Referansa git';
                path = `/references?focusId=${encodeURIComponent(
                  m.subject_id,
                )}`;
                break;
              default:
                break;
            }
          }

          const shortNote =
            m.note && m.note.length > 120
              ? `${m.note.slice(0, 120)}…`
              : m.note ?? '';

          return (
            <div
              key={m.id}
              className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {m.subject_name ?? 'İsimsiz'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Tarih: {formatDate(m.at)}
                    {m.next_at
                      ? ` · Sonraki: ${formatDate(m.next_at)}`
                      : ''}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                  {typeLabel}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-slate-700">
                {m.subject && (
                  <div>
                    <span className="block text-[10px] uppercase text-slate-400">
                      Başlık
                    </span>
                    <span className="font-medium">{m.subject}</span>
                  </div>
                )}
                <div className="flex gap-4">
                  <div>
                    <span className="block text-[10px] uppercase text-slate-400">
                      Memnuniyet
                    </span>
                    <span className="font-medium">{satisfactionDisplay}</span>
                  </div>
                </div>
                {shortNote && (
                  <div>
                    <span className="block text-[10px] uppercase text-slate-400">
                      Not
                    </span>
                    <span className="font-normal text-slate-600">
                      {shortNote}
                    </span>
                  </div>
                )}
              </div>

              {actionLabel && path && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => navigate(path)}
                    className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {actionLabel}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop / tablet: classic table (md ve üzeri) */}
      <ResponsiveTableShell className="hidden md:block">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {visibleColumns.map((col) => {
                const isSorted = prefsState.sortBy === col.id;
                const showSortIcon = col.sortable;

                let alignClass = 'text-left';
                if (col.id === 'satisfaction_10') {
                  alignClass = 'text-center';
                } else if (col.id === 'actions') {
                  alignClass = 'text-right';
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
                    case 'actions': {
                      if (!m.subject_id) {
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2 text-right text-slate-400"
                          >
                            -
                          </td>
                        );
                      }

                      let label = '';
                      let path = '';

                      switch (m.meeting_type) {
                        case 'patient':
                          label = 'Hastaya git';
                          path = `/patients?focusId=${encodeURIComponent(
                            m.subject_id,
                          )}`;
                          break;
                        case 'trial':
                          label = 'Denemeye git';
                          path = `/trials?focusId=${encodeURIComponent(
                            m.subject_id,
                          )}`;
                          break;
                        case 'reference':
                          label = 'Referansa git';
                          path = `/references?focusId=${encodeURIComponent(
                            m.subject_id,
                          )}`;
                          break;
                        default:
                          return (
                            <td
                              key={col.id}
                              className="px-3 py-2 text-right text-slate-400"
                            >
                              -
                            </td>
                          );
                      }

                      return (
                        <td key={col.id} className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(path)}
                            className="inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {label}
                          </button>
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
      </ResponsiveTableShell>

      {filteredRows.length === 0 && (
        <p className="text-[11px] text-slate-500">
          Bu filtreye uygun görüşme yok. Farklı bir filtre seçmeyi deneyin.
        </p>
      )}
    </div>
  );
}
