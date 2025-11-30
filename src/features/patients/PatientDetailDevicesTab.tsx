// src/features/patients/PatientDetailDevicesTab.tsx
// Device & sale summary tab for patient detail drawer.
// Uses aggregated fields from patient_list_with_device on the patient row
// for a compact "Cihaz + Satış Özeti" card and additionally lists
// per-device rows from inventory_items via sold_patient_id.

import type { PatientRow, PatientDeviceRow } from './types';
import { formatAmount } from './patientFormatUtils';
import { usePatientDevices } from './api/api.devices';

type PatientDetailDevicesTabProps = {
  patient: PatientRow;
};

function formatPaymentMethod(method: PatientRow['payment_method']): string {
  if (!method) return '-';
  switch (method) {
    case 'Tim':
      return 'Tim (firma üzerinden)';
    case 'Sivantos':
      return 'Sivantos (firma üzerinden)';
    case 'Kredi_Kartı':
      return 'Kredi Kartı';
    case 'Nakit':
      return 'Nakit';
    case 'Senet':
      return 'Senet (taksit)';
    default:
      return method;
  }
}

function formatEarSide(side: PatientDeviceRow['ear_side']): string {
  if (!side || side === 'none') return '-';
  switch (side) {
    case 'right':
      return 'Sağ';
    case 'left':
      return 'Sol';
    case 'bilateral':
      return 'Çift';
    default:
      return side;
  }
}

function formatItemType(type: PatientDeviceRow['item_type']): string {
  switch (type) {
    case 'hearing_aid':
      return 'Cihaz';
    case 'charger':
      return 'Şarj cihazı';
    default:
      return type;
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
  const hasDevice = !!patient.device_brand || !!patient.device_model;
  const deviceLabel = hasDevice
    ? [patient.device_brand, patient.device_model].filter(Boolean).join(' ')
    : '-';

  const totalDevicePrice =
    patient.device_total_price != null
      ? formatAmount(patient.device_total_price)
      : '-';

  const paymentMethodLabel = formatPaymentMethod(patient.payment_method);

  const cardSaleTotal =
    patient.card_sale_total != null
      ? formatAmount(patient.card_sale_total)
      : '-';

  const cardFeeRate =
    patient.card_fee_rate != null
      ? `${patient.card_fee_rate.toFixed(2)} %`
      : '-';

  const cardFeeAmount =
    patient.card_fee_amount != null
      ? formatAmount(patient.card_fee_amount)
      : '-';

  const {
    data: devices = [],
    isLoading,
    isError,
    error,
  } = usePatientDevices(patient.id);

  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase text-slate-500">
        Cihaz &amp; Satış Özeti
      </h4>

      {/* Aggregate summary card from patient_list_with_device */}
      <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Cihaz</span>
          <span className="max-w-[220px] text-right text-xs font-medium text-slate-900">
            {deviceLabel}
          </span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Toplam Cihaz Fiyatı</span>
          <span className="text-xs font-semibold text-slate-900">
            {totalDevicePrice}
          </span>
        </div>

        <div className="mt-1 flex justify-between gap-2 border-t border-slate-200 pt-1">
          <span className="text-xs text-slate-500">Ödeme Yöntemi</span>
          <span className="max-w-[220px] text-right text-xs font-medium text-slate-900">
            {paymentMethodLabel}
          </span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Kart Satış Toplamı</span>
          <span className="text-xs font-medium text-slate-900">
            {cardSaleTotal}
          </span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Kart Komisyon Oranı</span>
          <span className="text-xs font-medium text-slate-900">
            {cardFeeRate}
          </span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Kart Komisyon Tutarı</span>
          <span className="text-xs font-medium text-slate-900">
            {cardFeeAmount}
          </span>
        </div>

        {!hasDevice && (
          <p className="mt-1 text-[11px] text-slate-500">
            Bu hastaya bağlı cihaz özeti henüz görünmüyor. Stok modülü
            üzerinden satış kaydı yapıldığında burada listelenecek.
          </p>
        )}
      </div>

      {/* Per-device rows from inventory_items */}
      <div className="space-y-2">
        <h5 className="text-[11px] font-semibold uppercase text-slate-500">
          Stok Cihaz Kayıtları
        </h5>

        {isLoading && (
          <p className="text-[11px] text-slate-500">
            Bu hastaya bağlı cihaz satırları yükleniyor...
          </p>
        )}

        {isError && (
          <p className="text-[11px] text-red-600">
            Cihaz satırları alınırken bir hata oluştu:{' '}
            {(error as Error)?.message ?? 'Bilinmeyen hata'}
          </p>
        )}

        {!isLoading && !isError && devices.length === 0 && (
          <p className="text-[11px] text-slate-500">
            Bu hastaya stok modülü üzerinden bağlanmış cihaz satırı
            bulunmuyor. Inventory ekranından cihaz satışı yaptığınızda,
            ilgili satırlar burada görünecek.
          </p>
        )}

        {!isLoading && !isError && devices.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="min-w-full text-left text-[11px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-1 font-medium">Tarih</th>
                  <th className="px-2 py-1 font-medium">Tip</th>
                  <th className="px-2 py-1 font-medium">Marka</th>
                  <th className="px-2 py-1 font-medium">Model</th>
                  <th className="px-2 py-1 font-medium">Kulak</th>
                  <th className="px-2 py-1 font-medium text-right">
                    Liste Fiyatı
                  </th>
                  <th className="px-2 py-1 font-medium text-right">
                    Alış Fiyatı
                  </th>
                  <th className="px-2 py-1 font-medium">Barkod / Seri No</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="px-2 py-1 text-slate-800">
                      {formatDate(d.sold_at)}
                    </td>
                    <td className="px-2 py-1 text-slate-800">
                      {formatItemType(d.item_type)}
                    </td>
                    <td className="px-2 py-1 text-slate-800">{d.brand}</td>
                    <td className="px-2 py-1 text-slate-800">{d.model}</td>
                    <td className="px-2 py-1 text-slate-800">
                      {formatEarSide(d.ear_side)}
                    </td>
                    <td className="px-2 py-1 text-right text-slate-800">
                      {d.list_price != null
                        ? formatAmount(d.list_price)
                        : '-'}
                    </td>
                    <td className="px-2 py-1 text-right text-slate-800">
                      {d.purchase_price != null
                        ? formatAmount(d.purchase_price)
                        : '-'}
                    </td>
                    <td className="px-2 py-1 text-slate-800">
                      {d.barcode || d.serial_no || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
