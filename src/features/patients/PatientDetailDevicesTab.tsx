// src/features/patients/PatientDetailDevicesTab.tsx
// Summary: Device & sale summary tab for patient detail drawer.
// Uses aggregated fields from patient_list_with_device on the PatientRow
// (device_brand, device_model, device_total_price + payment metadata).

import type { PatientRow } from './types';
import { formatAmount } from './patientFormatUtils';

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

  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase text-slate-500">
        Cihaz &amp; Satış Özeti
      </h4>

      <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
        {/* Device row */}
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Cihaz</span>
          <span className="max-w-[220px] text-right text-xs font-medium text-slate-900">
            {deviceLabel}
          </span>
        </div>

        {/* Device total price */}
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Toplam Cihaz Fiyatı</span>
          <span className="text-xs font-semibold text-slate-900">
            {totalDevicePrice}
          </span>
        </div>

        {/* Payment summary */}
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
            Bu hastaya bağlı cihaz kaydı henüz görünmüyor. Stok modülü üzerinden
            cihaz bağlandığında burada listelenecek.
          </p>
        )}
      </div>
    </section>
  );
}
