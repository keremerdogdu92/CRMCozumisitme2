// src/features/patients/PatientDetailDevicesTab.tsx
// Summary: Device & sale summary tab for patient detail drawer.
// Uses aggregated fields from patient_list_with_device on the PatientRow
// (device_brand, device_model, device_total_price, device_ear_side_summary)
// and detailed per-device rows from inventory_items via usePatientDevices.

import type { PatientRow, PatientDeviceRow } from './types';
import { formatAmount } from './patientFormatUtils';
import { usePatientDevices } from './api/api.devices';

type PatientDetailDevicesTabProps = {
  patient: PatientRow;
};

function formatEarSummary(
  summary: PatientRow['device_ear_side_summary'],
): string {
  switch (summary) {
    case 'right':
      return 'Sağ';
    case 'left':
      return 'Sol';
    case 'bilateral':
      return 'Çift';
    default:
      return '-';
  }
}

function formatEarSide(side: PatientDeviceRow['ear_side']): string {
  switch (side) {
    case 'right':
      return 'Sağ';
    case 'left':
      return 'Sol';
    default:
      return '-';
  }
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
}

export function PatientDetailDevicesTab({
  patient,
}: PatientDetailDevicesTabProps) {
  const hasDeviceSummary = !!patient.device_brand || !!patient.device_model;

  const deviceLabel = hasDeviceSummary
    ? [patient.device_brand, patient.device_model].filter(Boolean).join(' ')
    : '-';

  // Tavsiye satış toplamı: stokta bağlı cihazların liste fiyatı toplamı.
  const recommendedTotal =
    patient.device_total_price != null
      ? formatAmount(patient.device_total_price)
      : '-';

  // Gerçek satış toplamı (ilk satış): şimdilik kart satış toplamından okunuyor.
  // İleride nakit/senet için ayrı alan eklersek bu hesap güncellenecek.
  const saleTotal =
    patient.sale_total_amount != null
      ? formatAmount(patient.sale_total_amount)
      : '-';

  const earSummaryLabel = formatEarSummary(patient.device_ear_side_summary);

  const { data: devices, isLoading } = usePatientDevices(patient.id);
  const deviceRows: PatientDeviceRow[] = devices ?? [];

  return (
    <section className="space-y-4">
      {/* Overall device summary card */}
      <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
        <h4 className="text-xs font-semibold uppercase text-slate-500">
          Cihaz
        </h4>

        {/* Device model */}
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Cihaz Modeli</span>
          <span className="max-w-[220px] text-right text-xs font-medium text-slate-900">
            {deviceLabel}
          </span>
        </div>

        {/* Ear summary */}
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Kulak</span>
          <span className="text-xs font-medium text-slate-900">
            {earSummaryLabel}
          </span>
        </div>

        {/* Recommended price total */}
        <div className="mt-1 flex justify-between gap-2 border-t border-slate-200 pt-1">
          <span className="text-xs text-slate-500">
            Tavsiye Satış Toplamı
          </span>
          <span className="text-xs font-semibold text-slate-900">
            {recommendedTotal}
          </span>
        </div>

        {/* Actual sale price total (first sale) */}
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">
            Gerçek Satış Fiyatı (ilk satış)
          </span>
          <span className="text-xs font-semibold text-slate-900">
            {saleTotal}
          </span>
        </div>

        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          Tavsiye satış toplamı, stokta bu hastaya bağlanan cihazların liste
          fiyatlarının toplamıdır. Gerçek satış fiyatı ise hasta kaydında
          girilen ilk satış tutarını gösterir. Sonradan eklenen aksesuar ve
          tamirler ayrı kalemler olarak izlenecektir.
        </p>

        {!hasDeviceSummary && (
          <p className="mt-1 text-[11px] text-slate-500">
            Bu hastaya bağlı cihaz kaydı henüz görünmüyor. Stok modülü
            üzerinden cihaz bağlandığında burada listelenecek.
          </p>
        )}
      </div>

      {/* Per-ear device breakdown */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-slate-500">
          Kulak Bazında Cihazlar
        </h4>

        {isLoading && (
          <p className="text-[11px] text-slate-500">Cihazlar yükleniyor…</p>
        )}

        {!isLoading && deviceRows.length === 0 && (
          <p className="text-[11px] text-slate-500">
            Bu hastaya bağlı stok cihazı bulunamadı. Satışı yapılan cihazları
            stok modülünden bu hastaya bağladığınızda burada görünecek.
          </p>
        )}

        {!isLoading &&
          deviceRows.map((d) => (
            <div
              key={d.id}
              className="space-y-1 rounded-md border border-slate-100 bg-white px-3 py-2 shadow-sm"
            >
              {/* Ear + model header */}
              <div className="flex justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase text-slate-500">
                    Kulak
                  </span>
                  <span className="text-xs font-semibold text-slate-900">
                    {formatEarSide(d.ear_side)}
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[11px] uppercase text-slate-500">
                    Marka / Model
                  </span>
                  <span className="text-xs font-medium text-slate-900">
                    {[d.brand, d.model].filter(Boolean).join(' ')}
                  </span>
                </div>
              </div>

              {/* Barcode / Serial */}
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase text-slate-500">
                    Barkod
                  </span>
                  <span className="text-[11px] text-slate-900">
                    {d.barcode || '-'}
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[11px] uppercase text-slate-500">
                    Seri No
                  </span>
                  <span className="text-[11px] text-slate-900">
                    {d.serial_no || '-'}
                  </span>
                </div>
              </div>

              {/* Sale date only – no per-ear prices */}
              <div className="mt-1 flex justify-between gap-2">
                <span className="text-[11px] uppercase text-slate-500">
                  Satış Tarihi
                </span>
                <span className="text-[11px] text-slate-900">
                  {formatDate(d.sold_at)}
                </span>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
