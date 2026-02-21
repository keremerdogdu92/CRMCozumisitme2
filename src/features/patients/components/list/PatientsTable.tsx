// src/features/patients/components/list/PatientsTable.tsx
// Summary: Patients listing UI with responsive layout: mobile cards + desktop table.
// Integrations:
// - Uses useTablePreferences for per-user persistence of column visibility/sorting/ui toggles.
// - Desktop toolbar includes TableColumnsControl + TableExportButtons.
// - Export uses csvUtils helpers and respects visible columns + current sorted order.
//
// Soft delete UI:
// - If onDeletePatient is provided, "Sil" button is shown for active rows.
// - If onRestorePatient is provided, "Geri Al" button is shown for deleted rows.

import { useMemo } from 'react';
import type { PatientRow } from '../../types';
import { ResponsiveTableShell } from '../../../../components/layout/ResponsiveTableShell';
import { useTablePreferences } from '../../../../components/table/useTablePreferences';
import { TableColumnsControl } from '../../../../components/table/TableColumnsControl';
import type { TableColumnDef } from '../../../../components/table/tableTypes';
import { useCurrentProfile } from '../../../auth/useCurrentProfile';
import { TableExportButtons } from '../../../../components/table/TableExportButtons';
import { exportToCsvFile, exportToXlsxFile } from '../../../../utils/csvUtils';

type PatientsTableProps = {
  patients: PatientRow[];
  onSelectPatient: (patient: PatientRow) => void;

  /**
   * Optional soft-delete handler.
   * If provided, a "Sil" button is rendered for ACTIVE rows only.
   */
  onDeletePatient?: (patient: PatientRow) => void;

  /**
   * Optional restore handler.
   * If provided, a "Geri Al" button is rendered for DELETED rows only.
   */
  onRestorePatient?: (patient: PatientRow) => void;
};

type PatientTableColumnId =
  | 'created_at'
  | 'full_name'
  | 'national_id'
  | 'phone'
  | 'device'
  | 'ear'
  | 'sale_total_amount'
  | 'satisfaction_10'
  | 'last_visit_at'
  | 'sgk'
  | 'invoice'
  | 'actions';

const PATIENT_COLUMNS: TableColumnDef<
  PatientRow & { _colId?: PatientTableColumnId }
>[] = [
    { id: 'created_at', label: 'Alış (Kayıt)', sortable: true, isDefaultVisible: true, accessor: (p) => p.created_at ?? null },
    { id: 'full_name', label: 'Ad Soyad', sortable: true, isDefaultVisible: true, accessor: (p) => p.full_name ?? '' },
    { id: 'national_id', label: 'TC Kimlik No', sortable: false, isDefaultVisible: true, accessor: (p) => p.national_id ?? '' },
    { id: 'phone', label: 'Telefon', sortable: false, isDefaultVisible: true, accessor: (p) => p.phone ?? '' },
    { id: 'device', label: 'Cihaz Modeli', sortable: false, isDefaultVisible: true, accessor: (p) => getDeviceLabel(p) },
    { id: 'ear', label: 'Kulak', sortable: false, isDefaultVisible: true, accessor: (p) => getDeviceEarLabel(p) },
    { id: 'sale_total_amount', label: 'Toplam Satış', sortable: true, isDefaultVisible: true, accessor: (p) => p.sale_total_amount ?? 0 },
    { id: 'satisfaction_10', label: 'Memnuniyet (1–10)', sortable: true, isDefaultVisible: true, accessor: (p) => p.satisfaction_10 ?? -1 },
    { id: 'last_visit_at', label: 'Son Görüşme', sortable: true, isDefaultVisible: true, accessor: (p) => p.last_visit_at ?? null },
    { id: 'sgk', label: 'SGK', sortable: true, isDefaultVisible: true, accessor: (p) => (p.sgk_flag ? 1 : 0) },
    { id: 'invoice', label: 'Fatura', sortable: true, isDefaultVisible: true, accessor: (p) => (p.invoice_issued ? 1 : 0) },
    { id: 'actions', label: 'İşlemler', sortable: false, isDefaultVisible: true },
  ];

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
}

function formatSgkWarning(p: PatientRow): string | null {
  if (!p.sgk_flag) return null;
  const needsPrescription = !p.sgk_prescription_received;
  const needsRecording = !p.sgk_recorded_to_system;

  if (!needsPrescription && !needsRecording) return null;

  if (needsPrescription && needsRecording) return 'Reçete ve sistem kaydı eksik';
  if (needsPrescription) return 'Reçete bekleniyor';
  return 'Sisteme işlenecek';
}

function formatInvoiceWarning(p: PatientRow): string | null {
  if (p.invoice_issued === false) return 'Fatura henüz kesilmedi';
  return null;
}

function formatPrice(amount: number | null): string {
  if (amount == null || Number.isNaN(amount)) return '-';
  try {
    return amount.toLocaleString('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${amount}`;
  }
}

function getDeviceLabel(p: PatientRow): string {
  if (p.device_brand || p.device_model) {
    return [p.device_brand, p.device_model].filter(Boolean).join(' ');
  }
  return '-';
}

function getDeviceEarLabel(p: PatientRow): string {
  const ear = p.device_ear_side_summary;
  if (ear === 'bilateral') return 'Çift';
  if (ear === 'right') return 'Sağ';
  if (ear === 'left') return 'Sol';
  return '-';
}

export function PatientsTable({
  patients,
  onSelectPatient,
  onDeletePatient,
  onRestorePatient,
}: PatientsTableProps) {
  const { data: profile } = useCurrentProfile();
  const userId = profile?.id ?? null;

  const handleDeleteClick = (patient: PatientRow) => {
    if (!onDeletePatient) return;

    const confirmed = window.confirm(
      `Bu hastayı silmek istediğinizden emin misiniz?\n\n` +
      `Silme işlemi, hastayı listeden kaldırır ve soft delete olarak işaretler. ` +
      `Gerekirse daha sonra geri alınabilir.`,
    );
    if (!confirmed) return;

    onDeletePatient(patient);
  };

  const handleRestoreClick = (patient: PatientRow) => {
    if (!onRestorePatient) return;

    const confirmed = window.confirm(
      `Bu hastayı geri almak istediğinizden emin misiniz?\n\n` +
      `Geri alma işlemi, hastayı tekrar aktif listelere dahil eder.`,
    );
    if (!confirmed) return;

    onRestorePatient(patient);
  };

  const {
    state: prefsState,
    visibleColumns,
    toggleColumn,
    setSort,
    isColumnVisible,
    isUiFlagEnabled,
    toggleUiFlag,
  } = useTablePreferences<PatientRow>('patients', PATIENT_COLUMNS, userId);

  const uiToggles = [
    {
      id: 'showSoftDeleteFilter',
      label: 'Silinenler filtresi',
      checked: isUiFlagEnabled('showSoftDeleteFilter', true),
      onToggle: () => toggleUiFlag('showSoftDeleteFilter'),
    },
  ];

  const sortedPatients = useMemo(() => {
    if (!prefsState.sortBy) return patients;

    const col = PATIENT_COLUMNS.find((c) => c.id === prefsState.sortBy);
    if (!col || !col.sortable) return patients;

    const accessor = col.accessor ?? ((row: PatientRow) => (row as any)[col.id]);

    const sorted = [...patients];
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
  }, [patients, prefsState.sortBy, prefsState.sortDir]);

  const handleExport = (type: 'csv' | 'xlsx') => {
    if (sortedPatients.length === 0) return;

    const exportableColumns = visibleColumns.filter((col) => col.id !== 'actions');
    if (exportableColumns.length === 0) return;

    const headers = exportableColumns.map((col) => col.label);

    const rowsForExport = sortedPatients.map((p) => {
      const deviceLabel = getDeviceLabel(p);
      const deviceEarLabel = getDeviceEarLabel(p);

      return exportableColumns.map((col) => {
        switch (col.id as PatientTableColumnId) {
          case 'created_at':
            return p.created_at ?? null;
          case 'full_name':
            return p.full_name;
          case 'national_id':
            return p.national_id ?? '';
          case 'phone':
            return p.phone ?? '';
          case 'device':
            return deviceLabel;
          case 'ear':
            return deviceEarLabel;
          case 'sale_total_amount':
            return p.sale_total_amount ?? null;
          case 'satisfaction_10':
            return p.satisfaction_10 ?? null;
          case 'last_visit_at':
            return p.last_visit_at ?? null;
          case 'sgk':
            return p.sgk_flag ? 'Evet' : 'Hayır';
          case 'invoice':
            return p.invoice_issued ? 'Kesildi' : 'Yok';
          default:
            return '';
        }
      });
    });

    const baseFileName = 'patients_export';

    if (type === 'csv') {
      exportToCsvFile({ fileName: baseFileName, headers, rows: rowsForExport });
    } else {
      exportToXlsxFile({ fileName: baseFileName, headers, rows: rowsForExport });
    }
  };

  if (sortedPatients.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500 sm:text-sm">
        Filtreye uyan hasta bulunamadı. Arama kutusunu temizleyebilir veya yeni
        hasta ekleyebilirsiniz.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 md:hidden">
        {sortedPatients.map((p) => {
          const isDeleted = !!p.deleted_at;
          const sgkWarning = formatSgkWarning(p);
          const invoiceWarning = formatInvoiceWarning(p);
          const hasAnyWarning = !!sgkWarning || !!invoiceWarning;

          const deviceLabel = getDeviceLabel(p);
          const deviceEarLabel = getDeviceEarLabel(p);
          const satisfactionDisplay =
            p.satisfaction_10 != null ? `${p.satisfaction_10} / 10` : '-';

          return (
            <div
              key={p.id}
              className={
                'rounded-lg border px-3 py-3 shadow-sm ' +
                (hasAnyWarning
                  ? 'border-amber-200 bg-amber-50/60'
                  : isDeleted
                    ? 'border-slate-200 bg-slate-50'
                    : 'border-slate-200 bg-white')
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {p.full_name}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                    Kayıt: {formatDate(p.created_at)}
                    {p.last_visit_at
                      ? ` · Son görüşme: ${formatDate(p.last_visit_at)}`
                      : ''}
                  </p>
                  {isDeleted && (
                    <p className="mt-1 text-[11px] font-medium text-amber-800">
                      Silinmiş kayıt
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectPatient(p)}
                    className="inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Detay
                  </button>

                  {!isDeleted && onDeletePatient && (
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(p)}
                      className="inline-flex items-center rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
                    >
                      Sil
                    </button>
                  )}

                  {isDeleted && onRestorePatient && (
                    <button
                      type="button"
                      onClick={() => handleRestoreClick(p)}
                      className="inline-flex items-center rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
                    >
                      Geri Al
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-slate-700 sm:grid-cols-2">
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Telefon
                  </span>
                  <span className="font-medium">
                    {p.phone && p.phone.trim().length > 0 ? p.phone : '-'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    TC Kimlik No
                  </span>
                  <span className="font-medium">
                    {p.national_id && p.national_id.trim().length > 0
                      ? p.national_id
                      : '-'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Cihaz
                  </span>
                  <span className="line-clamp-2 font-medium">{deviceLabel}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Kulak
                  </span>
                  <span className="font-medium">{deviceEarLabel}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Toplam Satış
                  </span>
                  <span className="font-semibold">
                    {formatPrice(p.sale_total_amount)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    SGK
                  </span>
                  <span
                    className={
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                      (p.sgk_flag
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-50 text-slate-500')
                    }
                  >
                    {p.sgk_flag ? 'Evet (SGK)' : 'Hayır'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Memnuniyet
                  </span>
                  <span className="font-medium">{satisfactionDisplay}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Fatura
                  </span>
                  <span
                    className={
                      p.invoice_issued
                        ? 'inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700'
                        : 'inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500'
                    }
                  >
                    {p.invoice_issued ? 'Kesildi' : 'Yok'}
                  </span>
                </div>
              </div>

              {sgkWarning && (
                <p className="mt-2 text-[11px] font-medium text-amber-800">
                  {sgkWarning}
                </p>
              )}
              {invoiceWarning && (
                <p className="mt-1 text-[11px] font-medium text-amber-800">
                  {invoiceWarning}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop/tablet */}
      <div className="hidden space-y-3 md:block">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-slate-500 sm:text-xs">
            Toplam <span className="font-semibold">{sortedPatients.length}</span>{' '}
            hasta kaydı var.
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <TableColumnsControl
              columns={PATIENT_COLUMNS}
              isColumnVisible={isColumnVisible}
              toggleColumn={toggleColumn}
              uiToggles={uiToggles}
            />
            <TableExportButtons
              onExportCsv={() => handleExport('csv')}
              onExportXlsx={() => handleExport('xlsx')}
            />
          </div>
        </div>

        <ResponsiveTableShell>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-xs lg:text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {visibleColumns.map((col) => {
                    const isSorted = prefsState.sortBy === col.id;
                    const alignClass =
                      col.id === 'sale_total_amount'
                        ? 'text-right'
                        : col.id === 'satisfaction_10'
                          ? 'text-center'
                          : col.id === 'actions'
                            ? 'text-right'
                            : 'text-left';

                    return (
                      <th
                        key={col.id}
                        className={`px-3 py-2 text-[11px] font-medium text-slate-600 sm:px-4 sm:py-2.5 sm:text-xs ${col.sortable ? 'cursor-pointer select-none' : ''
                          } ${alignClass}`}
                        onClick={() => col.sortable && setSort(col.id)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {col.sortable && isSorted && (
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
                {sortedPatients.map((p) => {
                  const isDeleted = !!p.deleted_at;
                  const sgkWarning = formatSgkWarning(p);
                  const invoiceWarning = formatInvoiceWarning(p);
                  const hasAnyWarning = !!sgkWarning || !!invoiceWarning;
                  const deviceLabel = getDeviceLabel(p);
                  const deviceEarLabel = getDeviceEarLabel(p);
                  const satisfactionDisplay =
                    p.satisfaction_10 != null ? `${p.satisfaction_10} / 10` : '-';

                  return (
                    <tr
                      key={p.id}
                      className={
                        'border-t border-slate-100 ' +
                        (hasAnyWarning ? 'bg-amber-50/40 ' : '') +
                        (isDeleted ? 'opacity-80 ' : '')
                      }
                    >
                      {visibleColumns.map((col) => {
                        switch (col.id as PatientTableColumnId) {
                          case 'created_at':
                            return (
                              <td
                                key={col.id}
                                className="whitespace-nowrap px-3 py-2 text-slate-700 sm:px-4 sm:py-2.5"
                              >
                                {formatDate(p.created_at)}
                              </td>
                            );
                          case 'full_name':
                            return (
                              <td
                                key={col.id}
                                className="max-w-[220px] truncate px-3 py-2 text-slate-800 sm:px-4 sm:py-2.5"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="truncate">{p.full_name}</span>
                                  {isDeleted && (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                                      Silinmiş
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          case 'national_id':
                            return (
                              <td
                                key={col.id}
                                className="whitespace-nowrap px-3 py-2 text-slate-700 sm:px-4 sm:py-2.5"
                              >
                                {p.national_id && p.national_id.trim().length > 0
                                  ? p.national_id
                                  : '-'}
                              </td>
                            );
                          case 'phone':
                            return (
                              <td
                                key={col.id}
                                className="whitespace-nowrap px-3 py-2 text-slate-700 sm:px-4 sm:py-2.5"
                              >
                                {p.phone ?? '-'}
                              </td>
                            );
                          case 'device':
                            return (
                              <td
                                key={col.id}
                                className="px-3 py-2 text-slate-700 sm:px-4 sm:py-2.5"
                              >
                                {deviceLabel}
                              </td>
                            );
                          case 'ear':
                            return (
                              <td
                                key={col.id}
                                className="px-3 py-2 text-slate-700 sm:px-4 sm:py-2.5"
                              >
                                {deviceEarLabel}
                              </td>
                            );
                          case 'sale_total_amount':
                            return (
                              <td
                                key={col.id}
                                className="px-3 py-2 text-right text-slate-700 sm:px-4 sm:py-2.5"
                              >
                                {formatPrice(p.sale_total_amount)}
                              </td>
                            );
                          case 'satisfaction_10':
                            return (
                              <td
                                key={col.id}
                                className="px-3 py-2 text-center text-slate-700 sm:px-4 sm:py-2.5"
                              >
                                {satisfactionDisplay}
                              </td>
                            );
                          case 'last_visit_at':
                            return (
                              <td
                                key={col.id}
                                className="whitespace-nowrap px-3 py-2 text-slate-700 sm:px-4 sm:py-2.5"
                              >
                                {formatDate(p.last_visit_at)}
                              </td>
                            );
                          case 'sgk':
                            return (
                              <td
                                key={col.id}
                                className="px-3 py-2 text-center sm:px-4 sm:py-2.5"
                              >
                                <div className="flex flex-col items-center gap-0.5">
                                  <span
                                    className={
                                      p.sgk_flag
                                        ? 'inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                                        : 'inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500'
                                    }
                                  >
                                    {p.sgk_flag ? 'Evet' : 'Hayır'}
                                  </span>
                                  {sgkWarning && (
                                    <span className="text-[10px] font-medium text-amber-700">
                                      {sgkWarning}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          case 'invoice':
                            return (
                              <td
                                key={col.id}
                                className="px-3 py-2 text-slate-700 sm:px-4 sm:py-2.5"
                              >
                                <div className="flex flex-col items-start gap-0.5">
                                  <span
                                    className={
                                      p.invoice_issued
                                        ? 'inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                                        : 'inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500'
                                    }
                                  >
                                    {p.invoice_issued ? 'Kesildi' : 'Yok'}
                                  </span>
                                  {p.invoice_issued_at && (
                                    <span className="text-[10px] text-slate-500">
                                      {formatDate(p.invoice_issued_at)}
                                    </span>
                                  )}
                                  {invoiceWarning && (
                                    <span className="text-[10px] font-medium text-amber-700">
                                      {invoiceWarning}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          case 'actions':
                            return (
                              <td
                                key={col.id}
                                className="whitespace-nowrap px-3 py-2 text-right sm:px-4 sm:py-2.5"
                              >
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onSelectPatient(p)}
                                    className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    Detay
                                  </button>

                                  {!isDeleted && onDeletePatient && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteClick(p)}
                                      className="inline-flex items-center rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                    >
                                      Sil
                                    </button>
                                  )}

                                  {isDeleted && onRestorePatient && (
                                    <button
                                      type="button"
                                      onClick={() => handleRestoreClick(p)}
                                      className="inline-flex items-center rounded-md border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                                    >
                                      Geri Al
                                    </button>
                                  )}
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
    </div>
  );
}
