// src/features/patients/PatientDetailAccessoriesTab.tsx
// Accessories tab for patient detail drawer: lists accessories sold in meetings.

import { useMemo } from 'react';
import { formatAmount, formatDateTime } from '../../patientFormatUtils';
import {
  usePatientAccessories,
  type PatientAccessoryRow,
} from './api/api.accessories';

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

  const totals = useMemo(() => {
    return (accessories as PatientAccessoryRow[]).reduce(
      (acc, row) => {
        const sale = Number(row.sale_price ?? 0);
        const cost = Number(row.cost_price ?? 0);
        return {
          saleTotal: acc.saleTotal + (Number.isFinite(sale) ? sale : 0),
          costTotal: acc.costTotal + (Number.isFinite(cost) ? cost : 0),
        };
      },
      { saleTotal: 0, costTotal: 0 },
    );
  }, [accessories]);

  const margin = totals.saleTotal - totals.costTotal;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase text-slate-500">
          Aksesuarlar
        </h4>
      </div>

      {isLoading && (
        <p className="text-xs text-slate-500">
          Aksesuar hareketleri yükleniyor...
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
          Bu hasta için kayıtlı aksesuar satışı bulunmuyor. Görüşme
          oluştururken &quot;Aksesuar&quot; alanını doldurarak yeni
          hareket ekleyebilirsiniz.
        </p>
      )}

      {!isLoading && !isError && accessories.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Tarih</th>
                  <th className="px-3 py-2 font-medium">Görüşme</th>
                  <th className="px-3 py-2 font-medium">Aksesuar</th>
                  <th className="px-3 py-2 font-medium text-right">
                    Satış
                  </th>
                  <th className="px-3 py-2 font-medium text-right">
                    Maliyet
                  </th>
                  <th className="px-3 py-2 font-medium text-right">
                    Kâr
                  </th>
                </tr>
              </thead>
              <tbody>
                {(accessories as PatientAccessoryRow[]).map((row) => {
                  const sale = Number(row.sale_price ?? 0);
                  const cost = Number(row.cost_price ?? 0);
                  const profit = sale - cost;

                  return (
                    <tr
                      key={row.id}
                      className="border-t border-slate-100"
                    >
                      <td className="px-3 py-2 text-slate-800">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.meeting_subject
                          ? row.meeting_subject.length > 40
                            ? row.meeting_subject.slice(0, 40) + '…'
                            : row.meeting_subject
                          : '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-800">
                        {row.name}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {formatAmount(sale)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {formatAmount(cost)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {formatAmount(profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-800 sm:grid-cols-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">Toplam satış</span>
              <span className="font-semibold">
                {formatAmount(totals.saleTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">Toplam maliyet</span>
              <span className="font-semibold">
                {formatAmount(totals.costTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">Toplam kâr</span>
              <span className="font-semibold">
                {formatAmount(margin)}
              </span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
