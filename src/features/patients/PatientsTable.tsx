// src/features/patients/PatientsTable.tsx
// Patients listing table with columns and "Detay" action.

import type { PatientRow } from './types';

type PatientsTableProps = {
  patients: PatientRow[];
  onSelectPatient: (patient: PatientRow) => void;
};

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('tr-TR');
}

function formatPrice(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '-';
  try {
    return (
      amount.toLocaleString('tr-TR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }) + ' ₺'
    );
  } catch {
    return `${amount} ₺`;
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

export function PatientsTable({ patients, onSelectPatient }: PatientsTableProps) {
  if (patients.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        Filtreye uyan hasta bulunamadı. Arama kutusunu temizleyebilir veya yeni
        hasta ekleyebilirsiniz.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
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
            <th className="px-4 py-2 text-right font-medium text-slate-600">
              İşlemler
            </th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => {
            const warning = formatSgkWarning(p);
            const hasSgkWarning = !!warning;

            const deviceLabel =
              p.device_brand && p.device_model
                ? `${p.device_brand} ${p.device_model}`
                : '-';

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
                <td className="px-4 py-2 text-slate-800">{p.full_name}</td>

                {/* Telefon */}
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                  {p.phone ?? '-'}
                </td>

                {/* Cihaz Modeli */}
                <td className="px-4 py-2 text-slate-700">{deviceLabel}</td>

                {/* Fiyat */}
                <td className="px-4 py-2 text-right text-slate-700">
                  {formatPrice(p.device_total_price)}
                </td>

                {/* Memnuniyet */}
                <td className="px-4 py-2 text-center text-slate-700">
                  {p.satisfaction_10 != null
                    ? p.satisfaction_10
                    : '-'}
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
    </div>
  );
}
