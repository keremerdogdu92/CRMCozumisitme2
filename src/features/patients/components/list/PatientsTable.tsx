// src/features/patients/components/list/PatientsTable.tsx
// Patients listing table with responsive layout: mobile cards + desktop table.
// Desktop table supports column visibility toggling and basic sorting.

import { useMemo } from 'react';
import type { PatientRow } from '../../types';
import { ResponsiveTableShell } from '../../../../components/layout/ResponsiveTableShell';
import { useTablePreferences } from '../../../../components/table/useTablePreferences';
import { TableColumnsControl } from '../../../../components/table/TableColumnsControl';
import type { TableColumnDef } from '../../../../components/table/tableTypes';
import { useCurrentProfile } from '../../../auth/useCurrentProfile';

type PatientsTableProps = {
  patients: PatientRow[];
  onSelectPatient: (patient: PatientRow) => void;
  /**
   * Optional soft-delete handler.
   * If provided, a "Sil" button is rendered and this callback is invoked
   * only after user confirmation.
   */
  onDeletePatient?: (patient: PatientRow) => void;
};

type PatientTableColumnId =
  | 'created_at'
  | 'full_name'
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
  {
    id: 'created_at',
    label: 'Alış (Kayıt)',
    sortable: true,
    isDefaultVisible: true,
    accessor: (p) => p.created_at ?? null,
  },
  {
    id: 'full_name',
    label: 'Ad Soyad',
    sortable: true,
    isDefaultVisible: true,
    accessor: (p) => p.full_name ?? '',
  },
  {
    id: 'phone',
    label: 'Telefon',
    sortable: false,
    isDefaultVisible: true,
    accessor: (p) => p.phone ?? '',
  },
  {
    id: 'device',
    label: 'Cihaz Modeli',
    sortable: false,
    isDefaultVisible: true,
    accessor: (p) => getDeviceLabel(p),
  },
  {
    id: 'ear',
    label: 'Kulak',
    sortable: false,
    isDefaultVisible: true,
    accessor: (p) => getDeviceEarLabel(p),
  },
  {
    id: 'sale_total_amount',
    label: 'Toplam Satış',
    sortable: true,
    isDefaultVisible: true,
    accessor: (p) => p.sale_total_amount ?? 0,
  },
  {
    id: 'satisfaction_10',
    label: 'Memnuniyet (1–10)',
    sortable: true,
    isDefaultVisible: true,
    accessor: (p) => p.satisfaction_10 ?? -1,
  },
  {
    id: 'last_visit_at',
    label: 'Son Görüşme',
    sortable: true,
    isDefaultVisible: true,
    accessor: (p) => p.last_visit_at ?? null,
  },
  {
    id: 'sgk',
    label: 'SGK',
    sortable: true,
    isDefaultVisible: true,
    accessor: (p) => (p.sgk_flag ? 1 : 0),
  },
  {
    id: 'invoice',
    label: 'Fatura',
    sortable: true,
    isDefaultVisible: true,
    accessor: (p) => (p.invoice_issued ? 1 : 0),
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

  if (needsPrescription && needsRecording) {
    return 'Reçete ve sistem kaydı eksik';
  }
  if (needsPrescription) return 'Reçete bekleniyor';
  return 'Sisteme işlenecek';
}

function formatInvoiceWarning(p: PatientRow): string | null {
  // Eski kayıtlarla uyum için sadece "explicit false" durumda uyarı gösteriyoruz.
  if (p.invoice_issued === false) {
    return 'Fatura henüz kesilmedi';
  }
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

  const {
    state: prefsState,
    visibleColumns,
    toggleColumn,
    setSort,
    isColumnVisible,
  } = useTablePreferences<PatientRow>('patients-table', PATIENT_COLUMNS, userId);

  const sortedPatients = useMemo(() => {
    if (!prefsState.sortBy) return patients;

    const col = PATIENT_COLUMNS.find((c) => c.id === prefsState.sortBy);
    if (!col || !col.sortable) return patients;

    const accessor =
      col.accessor ?? ((row: PatientRow) => (row as any)[col.id]);

    const sorted = [...patients];
    sorted.sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);

      // Null/undefined en sona
      const aNull = va == null;
      const bNull = vb == null;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      // Date string varsa Date olarak sort et
      if (typeof va === 'string' && typeof vb === 'string') {
        // Tarih gibi ise Date.parse ile, değilse normal string compare
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

      // Boolean / diğer tipler için fallback
      const av = va as any;
      const bv = vb as any;
      if (av < bv) return prefsState.sortDir === 'asc' ? -1 : 1;
      if (av > bv) return prefsState.sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [patients, prefsState.sortBy, prefsState.sortDir]);

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
      {/* Mobile: card list (md altı) */}
      <div className="space-y-3 md:hidden">
        {sortedPatients.map((p) => {
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
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectPatient(p)}
                    className="inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Detay
                  </button>
                  {onDeletePatient && (
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(p)}
                      className="inline-flex items-center rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
                    >
                      Sil
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-700">
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
                    Cihaz
                  </span>
                  <span className="line-clamp-2 font-medium">
                    {deviceLabel}
                  </span>
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

      {/* Desktop: classic table (md ve üzeri) */}
      <ResponsiveTableShell className="hidden md:block">
        {/* Toolbar: sağ üstte sütun kontrolü */}
        <div className="flex items-center justify-end px-4 py-2">
          <TableColumnsControl
            columns={PATIENT_COLUMNS}
            isColumnVisible={isColumnVisible}
            toggleColumn={toggleColumn}
          />
        </div>

        <table className="min-w-full text-xs lg:text-sm">
          <thead className="bg-slate-50">
            <tr>
              {visibleColumns.map((col) => {
                const isSorted = prefsState.sortBy === col.id;
                const showSortIcon = col.sortable;

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
                    className={`px-4 py-2 font-medium text-slate-600 ${
                      col.sortable ? 'cursor-pointer select-none' : ''
                    } ${alignClass}`}
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
            {sortedPatients.map((p) => {
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
                    (hasAnyWarning ? 'bg-amber-50/40' : '')
                  }
                >
                  {visibleColumns.map((col) => {
                    switch (col.id as PatientTableColumnId) {
                      case 'created_at':
                        return (
                          <td
                            key={col.id}
                            className="whitespace-nowrap px-4 py-2 text-slate-700"
                          >
                            {formatDate(p.created_at)}
                          </td>
                        );
                      case 'full_name':
                        return (
                          <td
                            key={col.id}
                            className="max-w-[220px] truncate px-4 py-2 text-slate-800"
                          >
                            {p.full_name}
                          </td>
                        );
                      case 'phone':
                        return (
                          <td
                            key={col.id}
                            className="whitespace-nowrap px-4 py-2 text-slate-700"
                          >
                            {p.phone ?? '-'}
                          </td>
                        );
                      case 'device':
                        return (
                          <td
                            key={col.id}
                            className="px-4 py-2 text-slate-700"
                          >
                            {deviceLabel}
                          </td>
                        );
                      case 'ear':
                        return (
                          <td
                            key={col.id}
                            className="px-4 py-2 text-slate-700"
                          >
                            {deviceEarLabel}
                          </td>
                        );
                      case 'sale_total_amount':
                        return (
                          <td
                            key={col.id}
                            className="px-4 py-2 text-right text-slate-700"
                          >
                            {formatPrice(p.sale_total_amount)}
                          </td>
                        );
                      case 'satisfaction_10':
                        return (
                          <td
                            key={col.id}
                            className="px-4 py-2 text-center text-slate-700"
                          >
                            {satisfactionDisplay}
                          </td>
                        );
                      case 'last_visit_at':
                        return (
                          <td
                            key={col.id}
                            className="whitespace-nowrap px-4 py-2 text-slate-700"
                          >
                            {formatDate(p.last_visit_at)}
                          </td>
                        );
                      case 'sgk':
                        return (
                          <td key={col.id} className="px-4 py-2 text-center">
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
                              {invoiceWarning && (
                                <span className="text-[10px] font-medium text-amber-700">
                                  {invoiceWarning}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      case 'invoice':
                        return (
                          <td key={col.id} className="px-4 py-2 text-slate-700">
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
                            </div>
                          </td>
                        );
                      case 'actions':
                        return (
                          <td
                            key={col.id}
                            className="px-4 py-2 text-right whitespace-nowrap"
                          >
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onSelectPatient(p)}
                                className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Detay
                              </button>
                              {onDeletePatient && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick(p)}
                                  className="inline-flex items-center rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                >
                                  Sil
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
      </ResponsiveTableShell>
    </div>
  );
}
