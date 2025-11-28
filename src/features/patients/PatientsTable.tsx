// src/features/patients/PatientsTable.tsx
// Patients listing table with responsive layout: mobile cards + desktop table.

import type { PatientRow } from './types';
import { ResponsiveTableShell } from '../../components/layout/ResponsiveTableShell';

type PatientsTableProps = {
  patients: PatientRow[];
  onSelectPatient: (patient: PatientRow) => void;
};

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

export function PatientsTable({
  patients,
  onSelectPatient,
}: PatientsTableProps) {
  if (patients.length === 0) {
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
        {patients.map((p) => {
          const warning = formatSgkWarning(p);
          const deviceLabel = getDeviceLabel(p);
          const satisfactionDisplay =
            p.satisfaction_10 != null ? `${p.satisfaction_10} / 10` : '-';

          return (
            <div
              key={p.id}
              className={
                'rounded-lg border px-3 py-3 shadow-sm ' +
                (warning
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
                  {p.archive_code && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                      Arşiv: {p.archive_code}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectPatient(p)}
                    className="inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Detay
                  </button>
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
                    Fiyat
                  </span>
                  <span className="font-semibold">
                    {formatPrice(p.device_total_price)}
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
              </div>

              {warning && (
                <p className="mt-2 text-[11px] font-medium text-amber-800">
                  {warning}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: classic table (md ve üzeri) */}
      <ResponsiveTableShell className="hidden md:block">
        <table className="min-w-full text-xs lg:text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-600">
                Alış (Kayıt)
              </th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">
                Ad Soyad
              </th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">
                Telefon
              </th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">
                Cihaz Modeli
              </th>
              <th className="px-4 py-2 text-right font-medium text-slate-600">
                Fiyat
              </th>
              <th className="px-4 py-2 text-center font-medium text-slate-600">
                Memnuniyet (1–10)
              </th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">
                Son Görüşme
              </th>
              <th className="px-4 py-2 text-center font-medium text-slate-600">
                SGK
              </th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">
                Arşiv Kodu
              </th>
              <th className="px-4 py-2 text-right font-medium text-slate-600">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => {
              const warning = formatSgkWarning(p);
              const deviceLabel = getDeviceLabel(p);
              const satisfactionDisplay =
                p.satisfaction_10 != null ? `${p.satisfaction_10} / 10` : '-';

              const hasSgkWarning = !!warning;

              return (
                <tr
                  key={p.id}
                  className={
                    'border-t border-slate-100 ' +
                    (hasSgkWarning ? 'bg-amber-50/40' : '')
                  }
                >
                  {/* Alış / kayıt tarihi */}
                  <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                    {formatDate(p.created_at)}
                  </td>

                  {/* Ad Soyad */}
                  <td className="max-w-[220px] truncate px-4 py-2 text-slate-800">
                    {p.full_name}
                  </td>

                  {/* Telefon */}
                  <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                    {p.phone ?? '-'}
                  </td>

                  {/* Cihaz Modeli */}
                  <td className="px-4 py-2 text-slate-700">
                    {deviceLabel}
                  </td>

                  {/* Fiyat */}
                  <td className="px-4 py-2 text-right text-slate-700">
                    {formatPrice(p.device_total_price)}
                  </td>

                  {/* Memnuniyet */}
                  <td className="px-4 py-2 text-center text-slate-700">
                    {satisfactionDisplay}
                  </td>

                  {/* Son Görüşme */}
                  <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                    {formatDate(p.last_visit_at)}
                  </td>

                  {/* SGK etiketi + uyarı */}
                  <td className="px-4 py-2 text-center">
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
                      {warning && (
                        <span className="text-[10px] font-medium text-amber-700">
                          {warning}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Arşiv Kodu */}
                  <td className="px-4 py-2 text-slate-700">
                    {p.archive_code ?? '-'}
                  </td>

                  {/* İşlemler – Detay çekmecesi */}
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectPatient(p)}
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
      </ResponsiveTableShell>
    </div>
  );
}
