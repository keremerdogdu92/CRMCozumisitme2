// src/features/patients/PatientDetailDevicesTab.tsx
// Device tab for patient detail drawer.
// Shows:
// - High-level device summary (brand + model from patient_list_with_device)
// - Price breakdown (purchase total, list-price total, first sale total)
// - Ear-based device list (right / left / bilateral) with barcode & serial.
//
// Devices are resolved from inventory_items via sold_patient_id using
// usePatientDevices. Stocks keep ear_side = NULL; it is set only after
// binding the device to the patient and choosing the ear.

import type { PatientRow, PatientDeviceRow } from './types';
import { formatAmount } from './patientFormatUtils';
import { usePatientDevices } from './api/api.devices';

type PatientDetailDevicesTabProps = {
  patient: PatientRow;
};

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
}

function formatEarSide(ear: PatientDeviceRow['ear_side']): string {
  if (ear === 'right') return 'Sağ';
  if (ear === 'left') return 'Sol';
  if (ear === 'bilateral') return 'Çift';
  return 'Belirsiz';
}

function formatOptionalTotal(total: number, hasAnyDevice: boolean): string {
  if (!hasAnyDevice || total <= 0) return '-';
  return formatAmount(total);
}

function getPrimaryDeviceLabel(
  patient: PatientRow,
  devices: PatientDeviceRow[],
): string {
  const summaryFromPatient =
    patient.device_brand || patient.device_model
      ? [patient.device_brand, patient.device_model].filter(Boolean).join(' ')
      : null;

  if (summaryFromPatient) {
    return summaryFromPatient;
  }

  if (devices.length === 0) return '-';

  const first = devices[0];
  return [first.brand, first.model].filter(Boolean).join(' ') || '-';
}

export function PatientDetailDevicesTab({
  patient,
}: PatientDetailDevicesTabProps) {
  const { data: devices = [], isLoading } = usePatientDevices(patient.id);

  const hasAnyDevice = devices.length > 0;
  const deviceLabel = getPrimaryDeviceLabel(patient, devices);

  const purchaseTotal = devices.reduce(
    (sum, d) => sum + (d.purchase_price ?? 0),
    0,
  );
  const listPriceTotal = devices.reduce(
    (sum, d) => sum + (d.list_price ?? 0),
    0,
  );

  const purchaseTotalDisplay = formatOptionalTotal(
    purchaseTotal,
    hasAnyDevice,
  );
  const listPriceTotalDisplay = formatOptionalTotal(
    listPriceTotal,
    hasAnyDevice,
  );
  const saleTotalDisplay =
    patient.device_total_price != null
      ? formatAmount(patient.device_total_price)
      : '-';

  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase text-slate-500">
        Cihaz
      </h4>

      {/* Summary card: primary model / brand info */}
      <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Cihaz Modeli</span>
          <span className="max-w-[220px] text-right text-xs font-medium text-slate-900">
            {deviceLabel}
          </span>
        </div>

        {!hasAnyDevice && (
          <p className="mt-1 text-[11px] text-slate-500">
            Bu hastaya bağlı cihaz kaydı henüz görünmüyor. Stok modülünden
            cihaz bağlandığında burada listelenecek.
          </p>
        )}
      </div>

      {/* Price breakdown: purchase, list, first sale total */}
      <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">
            Geliş Fiyatı Toplamı
          </span>
          <span className="text-xs font-medium text-slate-900">
            {purchaseTotalDisplay}
          </span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">
            Tavsiye Satış Toplamı
          </span>
          <span className="text-xs font-medium text-slate-900">
            {listPriceTotalDisplay}
          </span>
        </div>

        <div className="mt-1 border-t border-slate-200 pt-1 flex justify-between gap-2">
          <span className="text-xs text-slate-500">
            Gerçek Satış Fiyatı (ilk satış)
          </span>
          <span className="text-xs font-semibold text-slate-900">
            {saleTotalDisplay}
          </span>
        </div>

        <p className="mt-1 text-[10px] text-slate-500">
          İlk satışta alınan cihaz ve o ana kadar eklenen aksesuarların toplamı
          hasta kaydındaki satış fiyatı alanından gelir. Geliş ve liste
          fiyatları, stokta seçilen cihaz satırlarının toplamıdır.
        </p>

        {/* [TODO] Later: include accessory / repair events from meetings/payments
            here and add their amounts into accessory-specific revenue stats
            on the dashboard. */}
      </div>

      {/* Ear-based device list */}
      <div className="space-y-2 rounded-md border border-slate-100 bg-white px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-600">
            Kulak Bazında Cihazlar
          </span>
          {isLoading && (
            <span className="text-[10px] text-slate-400">
              Yükleniyor...
            </span>
          )}
        </div>

        {devices.length === 0 && !isLoading && (
          <p className="text-[11px] text-slate-500">
            Bu hastaya henüz stoktan cihaz bağlanmadı. Hasta oluştururken veya
            düzenlerken stoktan cihaz seçtiğinizde, hangi seri/barkodun sağda
            hangisinin solda olduğunu burada görebilirsiniz.
          </p>
        )}

        {devices.length > 0 && (
          <div className="divide-y divide-slate-100">
            {devices.map((d) => (
              <div key={d.id} className="py-2 first:pt-0 last:pb-0">
                <div className="flex justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase text-slate-400">
                      Kulak
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      {formatEarSide(d.ear_side)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col items-end gap-0.5">
                    <span className="text-[10px] uppercase text-slate-400">
                      Marka / Model
                    </span>
                    <span className="max-w-[220px] truncate text-xs font-medium text-slate-900">
                      {[d.brand, d.model].filter(Boolean).join(' ')}
                    </span>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                  <div>
                    <span className="block text-[10px] uppercase text-slate-400">
                      Barkod
                    </span>
                    <span className="font-medium">
                      {d.barcode ?? '-'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-slate-400">
                      Seri No
                    </span>
                    <span className="font-medium">
                      {d.serial_no ?? '-'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-slate-400">
                      Geliş Fiyatı
                    </span>
                    <span className="font-medium">
                      {d.purchase_price != null
                        ? formatAmount(d.purchase_price)
                        : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-slate-400">
                      Tavsiye Satış
                    </span>
                    <span className="font-medium">
                      {d.list_price != null
                        ? formatAmount(d.list_price)
                        : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-slate-400">
                      Satış Tarihi
                    </span>
                    <span className="font-medium">
                      {formatDate(d.sold_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
