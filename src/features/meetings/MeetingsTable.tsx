// src/features/meetings/MeetingsTable.tsx
// Summary: Meetings list table with meeting_type + subject info, filters,
// column visibility toggles, sorting, export, and soft-delete actions.
// Integrations:
// - useMeetingsQuery: loads meetings with deleted_at support.
// - useSoftDeleteMeetingMutation / useRestoreMeetingMutation: calls Supabase RPCs.
// - SoftDeleteModeFilter: admin-oriented visibility control for deleted rows.
// - useTablePreferences + TableColumnsControl: column visibility and sorting.
// - TableExportButtons + csvUtils: export filtered + sorted rows (excluding actions).
//
// Security / Behavior notes:
// - Hard delete is not used; all deletes are soft deletes via RPC.
// - Default list mode is "active" (deleted rows hidden).
// - Staff users never see reference-type meetings (client-side defense-in-depth).
//
// Patch v1.2 (meeting note readability):
// - FIX: Replace hard slicing (120 chars) with multi-line preview + "Devamı" to view full note.
// - ADD: Accessible, dependency-free modal for reading/copying full meeting note (works on mobile + desktop).
// - UX: Keeps table/card layout compact while making full note available on demand.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useMeetingsQuery,
  useRestoreMeetingMutation,
  useSoftDeleteMeetingMutation,
} from './api';
import type { MeetingRow, MeetingType } from './types';
import { useCurrentProfile } from '../auth/useCurrentProfile';
import { useTablePreferences } from '../../components/table/useTablePreferences';
import { TableColumnsControl } from '../../components/table/TableColumnsControl';
import type { TableColumnDef } from '../../components/table/tableTypes';
import { exportToCsvFile, exportToXlsxFile } from '../../utils/csvUtils';
import { TableExportButtons } from '../../components/table/TableExportButtons';
import { ResponsiveTableShell } from '../../components/layout/ResponsiveTableShell';
import { SoftDeleteModeFilter } from '../../components/table/SoftDeleteModeFilter';
import type { SoftDeleteMode } from '../../utils/softDelete/softDeleteTypes';

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

function isDeleted(m: MeetingRow): boolean {
  return !!m.deleted_at;
}

type NoteModalState = {
  meetingId: string;
  title: string;
  note: string;
} | null;

function buildNoteTitle(m: MeetingRow): string {
  const who = (m.subject_name ?? 'İsimsiz').trim();
  const at = formatDate(m.at);
  const type = formatMeetingType(m.meeting_type);
  return `${who} · ${type} · ${at}`;
}

function hasMeaningfulNote(note: string | null | undefined): boolean {
  return typeof note === 'string' && note.trim().length > 0;
}

function isProbablyTruncated(note: string, minCharsForAction: number): boolean {
  // This heuristic avoids showing "Devamı" for very short notes.
  // It does not need to be perfect; the key is to enable full reading when notes are longer.
  return note.trim().length > minCharsForAction;
}

export function MeetingsTable() {
  const { data, isLoading, isError, error } = useMeetingsQuery();
  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.role === 'admin';
  const userId = profile?.id ?? null;
  const navigate = useNavigate();

  const [typeFilter, setTypeFilter] = useState<MeetingType | 'all'>('all');
  const [softDeleteMode, setSoftDeleteMode] = useState<SoftDeleteMode>('active');

  const [noteModal, setNoteModal] = useState<NoteModalState>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedElRef = useRef<HTMLElement | null>(null);

  const softDeleteMutation = useSoftDeleteMeetingMutation();
  const restoreMutation = useRestoreMeetingMutation();

  const {
    state: prefsState,
    visibleColumns,
    toggleColumn,
    setSort,
    isColumnVisible,
  } = useTablePreferences<MeetingRow>('meetings-table', MEETING_COLUMNS, userId);

  // NOTE: Even during loading/error, we compute with safe defaults so hooks remain stable.
  const safeData: MeetingRow[] = (data ?? []) as MeetingRow[];

  // Normalize older rows into a safe MeetingRow shape.
  const rows: MeetingRow[] = safeData.map((m) => {
    const meeting_type = (m.meeting_type ?? 'patient') as MeetingType;
    const subject_name = (m.subject_name ?? null) as string | null;
    const subject_id = (m.subject_id ?? null) as string | null;

    return {
      ...m,
      meeting_type,
      subject_name,
      subject_id,
      // deleted_at may be missing in older cached payloads; normalize to null.
      deleted_at: (m.deleted_at ?? null) as string | null,
    };
  });

  // Defense-in-depth: hide reference meetings from non-admin users.
  const roleVisibleRows: MeetingRow[] = isAdmin
    ? rows
    : rows.filter((m) => m.meeting_type !== 'reference');

  // Soft delete mode filtering (default: active only).
  const softDeleteFilteredRows: MeetingRow[] = (() => {
    if (softDeleteMode === 'all') return roleVisibleRows;
    if (softDeleteMode === 'deleted') return roleVisibleRows.filter((m) => isDeleted(m));
    return roleVisibleRows.filter((m) => !isDeleted(m));
  })();

  const filteredRows: MeetingRow[] =
    typeFilter === 'all'
      ? softDeleteFilteredRows
      : softDeleteFilteredRows.filter((m) => m.meeting_type === typeFilter);

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

    // Exclude the "actions" column from exports.
    const exportableColumns = visibleColumns.filter((col) => col.id !== 'actions');
    if (exportableColumns.length === 0) return;

    const headers = exportableColumns.map((col) => col.exportLabel ?? col.label);

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
      exportToCsvFile({ fileName: baseFileName, headers, rows: rowsForExport });
    } else {
      exportToXlsxFile({ fileName: baseFileName, headers, rows: rowsForExport });
    }
  };

  function getSubjectNav(m: MeetingRow): { label: string; path: string } | null {
    if (!m.subject_id) return null;

    switch (m.meeting_type) {
      case 'patient':
        return {
          label: 'Hastaya git',
          path: `/patients?focusId=${encodeURIComponent(m.subject_id)}`,
        };
      case 'trial':
        return {
          label: 'Denemeye git',
          path: `/trials?focusId=${encodeURIComponent(m.subject_id)}`,
        };
      case 'reference':
        return {
          label: 'Referansa git',
          path: `/references?focusId=${encodeURIComponent(m.subject_id)}`,
        };
      default:
        return null;
    }
  }

  function openNoteModal(m: MeetingRow) {
    const note = (m.note ?? '').trim();
    if (!note) return;

    // Track focus so we can restore it when modal closes (basic accessibility).
    previouslyFocusedElRef.current = document.activeElement as HTMLElement | null;

    setNoteModal({
      meetingId: m.id,
      title: buildNoteTitle(m),
      note,
    });
  }

  function closeNoteModal() {
    setNoteModal(null);

    // Restore focus after closing (best-effort).
    const prev = previouslyFocusedElRef.current;
    if (prev && typeof prev.focus === 'function') {
      // Use microtask to ensure DOM is settled.
      queueMicrotask(() => prev.focus());
    }
  }

  async function copyNoteToClipboard(note: string) {
    // Clipboard API may be blocked in some environments; fallback to execCommand.
    try {
      await navigator.clipboard.writeText(note);
      return;
    } catch {
      // Fallback: create a temporary textarea.
      try {
        const ta = document.createElement('textarea');
        ta.value = note;
        ta.setAttribute('readonly', 'true');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        // If copy fails, we silently ignore to avoid noisy UX.
      }
    }
  }

  useEffect(() => {
    if (!noteModal) return;

    // Focus the close button for keyboard accessibility.
    queueMicrotask(() => {
      closeBtnRef.current?.focus();
    });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeNoteModal();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteModal]);

  async function handleSoftDeleteMeeting(m: MeetingRow) {
    // UI-level reason capture. Keep it simple; DB accepts NULL as well.
    const reason = window.prompt('Silme nedeni (opsiyonel):', '') ?? '';
    const trimmed = reason.trim();

    try {
      await softDeleteMutation.mutateAsync({
        id: m.id,
        reason: trimmed.length > 0 ? trimmed : null,
      });
    } catch {
      // Errors are surfaced via mutation state; no extra noisy alerts here.
    }
  }

  async function handleRestoreMeeting(m: MeetingRow) {
    try {
      await restoreMutation.mutateAsync({ id: m.id });
    } catch {
      // Errors are surfaced via mutation state; no extra noisy alerts here.
    }
  }

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

  if (roleVisibleRows.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Henüz kayıtlı görüşme yok. Yukarıdan yeni bir görüşme ekleyebilirsiniz.
      </p>
    );
  }

  const mutationErrorMessage =
    (softDeleteMutation.error as Error | null)?.message ||
    (restoreMutation.error as Error | null)?.message ||
    null;

  const anyPending =
    softDeleteMutation.isPending || restoreMutation.isPending;

  const NotePreview = ({
    note,
    onOpen,
    previewLines,
    minCharsForAction,
    className = '',
  }: {
    note: string | null | undefined;
    onOpen: () => void;
    previewLines: 2 | 3;
    minCharsForAction: number;
    className?: string;
  }) => {
    const raw = (note ?? '').trim();
    if (!raw) return null;

    const showAction = isProbablyTruncated(raw, minCharsForAction);

    // Multi-line clamp without relying on Tailwind line-clamp plugin.
    // This keeps the UI stable while allowing long content to be opened.
    const clampStyle: React.CSSProperties = {
      display: '-webkit-box',
      WebkitBoxOrient: 'vertical',
      WebkitLineClamp: previewLines,
      overflow: 'hidden',
    };

    return (
      <div className={className}>
        <div className="min-w-0">
          <p className="text-slate-600" style={clampStyle}>
            {raw}
          </p>

          {showAction && (
            <button
              type="button"
              onClick={onOpen}
              className="mt-1 inline-flex items-center text-[11px] font-medium text-primary-700 hover:underline"
            >
              Devamı
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Note modal (dependency-free). */}
      {noteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Görüşme Notu"
        >
          {/* Overlay */}
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/40"
            aria-label="Kapat"
            onClick={closeNoteModal}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Görüşme Notu</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {noteModal.title}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => copyNoteToClipboard(noteModal.note)}
                >
                  Kopyala
                </button>

                <button
                  ref={closeBtnRef}
                  type="button"
                  className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  onClick={closeNoteModal}
                >
                  Kapat
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
              <p className="whitespace-pre-wrap break-words text-sm text-slate-800">
                {noteModal.note}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter bar + sütun kontrolü + export butonları + soft delete mode */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-[11px] text-slate-500">
          Toplam{' '}
          <span className="font-semibold">{roleVisibleRows.length}</span>{' '}
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
            <SoftDeleteModeFilter value={softDeleteMode} onChange={setSoftDeleteMode} />
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

      {mutationErrorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          İşlem hatası: {mutationErrorMessage}
        </div>
      )}

      {/* Mobile: card list (md altı) */}
      <div className="space-y-3 md:hidden">
        {sortedRows.map((m) => {
          const typeLabel = formatMeetingType(m.meeting_type);
          const satisfactionDisplay =
            m.satisfaction_10 != null ? `${m.satisfaction_10} / 10` : '-';

          const nav = getSubjectNav(m);
          const deleted = isDeleted(m);

          return (
            <div
              key={m.id}
              className={
                'rounded-lg border px-3 py-3 shadow-sm ' +
                (deleted
                  ? 'border-slate-200 bg-slate-50'
                  : 'border-slate-200 bg-white')
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={
                      'truncate text-sm font-semibold ' +
                      (deleted ? 'text-slate-500 line-through' : 'text-slate-900')
                    }
                  >
                    {m.subject_name ?? 'İsimsiz'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Tarih: {formatDate(m.at)}
                    {m.next_at ? ` · Sonraki: ${formatDate(m.next_at)}` : ''}
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

                {hasMeaningfulNote(m.note) && (
                  <div>
                    <span className="block text-[10px] uppercase text-slate-400">
                      Not
                    </span>

                    <NotePreview
                      note={m.note}
                      previewLines={3}
                      minCharsForAction={140}
                      onOpen={() => openNoteModal(m)}
                      className="mt-0.5"
                    />
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {nav && (
                  <button
                    type="button"
                    onClick={() => navigate(nav.path)}
                    className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {nav.label}
                  </button>
                )}

                {!deleted ? (
                  <button
                    type="button"
                    disabled={anyPending}
                    onClick={() => handleSoftDeleteMeeting(m)}
                    className="inline-flex items-center rounded-md border border-red-200 bg-white px-3 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Sil
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={anyPending}
                    onClick={() => handleRestoreMeeting(m)}
                    className="inline-flex items-center rounded-md border border-emerald-200 bg-white px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Geri Getir
                  </button>
                )}
              </div>
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
            {sortedRows.map((m) => {
              const deleted = isDeleted(m);
              const nav = getSubjectNav(m);

              return (
                <tr
                  key={m.id}
                  className={
                    'border-t border-slate-100 ' +
                    (deleted ? 'bg-slate-50' : 'bg-white')
                  }
                >
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
                          <td
                            key={col.id}
                            className={
                              'px-3 py-2 ' +
                              (deleted
                                ? 'text-slate-500 line-through'
                                : 'text-slate-800')
                            }
                          >
                            {m.subject_name ?? '-'}
                          </td>
                        );
                      case 'subject':
                        return (
                          <td
                            key={col.id}
                            className={
                              'px-3 py-2 ' +
                              (deleted ? 'text-slate-500' : 'text-slate-800')
                            }
                          >
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
                      case 'note':
                        return (
                          <td key={col.id} className="px-3 py-2">
                            {hasMeaningfulNote(m.note) ? (
                              <NotePreview
                                note={m.note}
                                previewLines={2}
                                minCharsForAction={120}
                                onOpen={() => openNoteModal(m)}
                              />
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        );
                      case 'actions': {
                        return (
                          <td key={col.id} className="px-3 py-2 text-right">
                            <div className="inline-flex flex-wrap justify-end gap-2">
                              {nav ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(nav.path)}
                                  className="inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  {nav.label}
                                </button>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}

                              {!deleted ? (
                                <button
                                  type="button"
                                  disabled={anyPending}
                                  onClick={() => handleSoftDeleteMeeting(m)}
                                  className="inline-flex items-center rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Sil
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={anyPending}
                                  onClick={() => handleRestoreMeeting(m)}
                                  className="inline-flex items-center rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Geri Getir
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      }
                      default:
                        return null;
                    }
                  })}
                </tr>
              );
            })}
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
