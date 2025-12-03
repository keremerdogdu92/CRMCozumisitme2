// src/features/patients/components/detail/PatientDetailAccessoriesTab.tsx
// Accessories tab for patient detail drawer: lists accessories sold via meetings.

import type { PatientAccessoryRow } from '../../api/api.accessories';
import { usePatientAccessories } from '../../api/api.accessories';
import { formatDateTime } from '../../patientFormatUtils';

type PatientDetailAccessoriesTabProps = {
  patientId: string;
  open: boolean;
};

export function PatientDetailAccessoriesTab({
  patientId,
  open,
}: PatientDetailAccessoriesTabProps) {
  const {
    data: accessories = [],
    isLoading,
    isError,
    error,
  } = usePatientAccessories(open ? patientId : null);

  if (!open) return null;

  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase text-slate-500">
        Aksesuarlar
      </h4>

      {isLoading && (
        <p className="text-xs text-slate-500">
          Aksesuar kayıtları yükleniyor...
        </p>
      )}

      {isError && (
        <p className="text-xs text-red-600">
          Aksesuarlar alınırken bir hata oluştu:{' '}
          {(error as Error)?.message ?? 'Bilinmeyen hata'}
        </p>
      )}

      {!isLoading && !isError && accessories.length === 0 && (
        <p className="text-xs text-slate-500">
          Bu hasta için henüz aksesuar kaydı yok. Görüşmeler ekranından
          aksesuar satışı ekleyebilirsiniz.
        </p>
      )}

      {!isLoading && !isError && accessories.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Tarih</th>
                <th className="px-3 py-2 font-medium">Görüşme</th>
                <th className="px-3 py-2 font-medium">Aksesuar</th>
                <th className="px-3 py-2 font-medium">Satış</th>
                <th className="px-3 py-2 font-medium">Maliyet</th>
              </tr>
            </thead>
            <tbody>
              {accessories.map((row: PatientAccessoryRow) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100"
                >
                  <td className="px-3 py-2 text-slate-800">
                    {row.meetingAt
                      ? formatDateTime(row.meetingAt)
                      : formatDateTime(row.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    {row.meetingSubject ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    {row.name}
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    {row.salePrice != null
                      ? row.salePrice.toLocaleString('tr-TR', {
                          style: 'currency',
                          currency: 'TRY',
                          minimumFractionDigits: 2,
                        })
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    {row.costPrice != null
                      ? row.costPrice.toLocaleString('tr-TR', {
                          style: 'currency',
                          currency: 'TRY',
                          minimumFractionDigits: 2,
                        })
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
