// src/features/patients/NewPatientPaymentSection.tsx
// Payment method selector and optional card details for new patient form.

import type { PatientPaymentMethodFormValue } from './types';

const PAYMENT_METHOD_OPTIONS: {
  value: PatientPaymentMethodFormValue;
  label: string;
}[] = [
  { value: '', label: 'Seçilmedi' },
  { value: 'Tim', label: 'Tim' },
  { value: 'Sivantos', label: 'Sivantos' },
  { value: 'Kredi_Kartı', label: 'Kredi Kartı' },
  { value: 'Nakit', label: 'Nakit' },
  { value: 'Senet', label: 'Senet' },
];

type NewPatientPaymentSectionProps = {
  paymentMethod: PatientPaymentMethodFormValue;
  /**
   * Toplam gerçek satış (cihaz + aksesuar, tüm ödeme türleri için ortak).
   */
  saleTotal: string;
  /**
   * Sadece kredi kartı için; taksit tablosundan gelen komisyon oranı.
   */
  cardFeeRate: string;
  onChangePaymentMethod: (value: PatientPaymentMethodFormValue) => void;
  onChangeSaleTotal: (value: string) => void;
  onChangeCardFeeRate: (value: string) => void;
};

export function NewPatientPaymentSection({
  paymentMethod,
  saleTotal,
  cardFeeRate,
  onChangePaymentMethod,
  onChangeSaleTotal,
  onChangeCardFeeRate,
}: NewPatientPaymentSectionProps) {
  const isCard = paymentMethod === 'Kredi_Kartı';

  const handlePaymentMethodChange = (
    value: PatientPaymentMethodFormValue,
  ) => {
    onChangePaymentMethod(value);
    if (value !== 'Kredi_Kartı') {
      // Non-card methods do not use card-specific fields
      onChangeCardFeeRate('');
    }
  };

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
      <label className="mb-1 block text-xs font-medium text-slate-600">
        Ödeme Şekli ve Toplam Satış
      </label>
      <div className="grid gap-2 md:grid-cols-4 md:items-end">
        {/* Ödeme şekli */}
        <div className="md:col-span-1">
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={paymentMethod}
            onChange={(e) =>
              handlePaymentMethodChange(
                e.target.value as PatientPaymentMethodFormValue,
              )
            }
          >
            {PAYMENT_METHOD_OPTIONS.map((opt) => (
              <option key={opt.value || 'none'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Senet seçersen taksit planını hasta detayındaki Ödemeler
            sekmesinden tanımlayacağız. İleride birden fazla ödeme
            yöntemi eklenebilecek.
          </p>
        </div>

        {/* Toplam gerçek satış (tüm yöntemler için ortak) */}
        <div className="md:col-span-1">
          <label className="mb-1 block text-[11px] font-medium text-slate-600">
            Toplam Satış Tutarı
          </label>
          <input
            type="text"
            value={saleTotal}
            onChange={(e) => onChangeSaleTotal(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Örn. 80.000"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Cihaz + aksesuarlar dahil toplam satış. Tüm ödeme türleri
            için ortaktır.
          </p>
        </div>

        {/* Kredi kartı komisyon oranı */}
        {isCard && (
          <>
            <div className="md:col-span-1">
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Komisyon (%) – Kart
              </label>
              <input
                type="text"
                value={cardFeeRate}
                onChange={(e) => onChangeCardFeeRate(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Örn. 3.5"
              />
            </div>
            <div className="md:col-span-1">
              <p className="text-[11px] text-slate-500">
                Kartla yapılan satışlarda seçilen taksite göre bu oran
                tablo üzerinden otomatik dolacak. Nakit / Tim / Sivantos
                / Senet seçeneklerinde komisyon kullanılmaz.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
