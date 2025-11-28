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
  cardSaleTotal: string;
  cardFeeRate: string;
  onChangePaymentMethod: (value: PatientPaymentMethodFormValue) => void;
  onChangeCardSaleTotal: (value: string) => void;
  onChangeCardFeeRate: (value: string) => void;
};

export function NewPatientPaymentSection({
  paymentMethod,
  cardSaleTotal,
  cardFeeRate,
  onChangePaymentMethod,
  onChangeCardSaleTotal,
  onChangeCardFeeRate,
}: NewPatientPaymentSectionProps) {
  const isCard = paymentMethod === 'Kredi_Kartı';

  const handlePaymentMethodChange = (
    value: PatientPaymentMethodFormValue,
  ) => {
    onChangePaymentMethod(value);
    if (value !== 'Kredi_Kartı') {
      // Non-card methods do not use card-specific fields
      onChangeCardSaleTotal('');
      onChangeCardFeeRate('');
    }
  };

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
      <label className="mb-1 block text-xs font-medium text-slate-600">
        Ödeme Şekli
      </label>
      <div className="grid gap-2 md:grid-cols-4 md:items-end">
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
            sekmesinden tanımlayacağız.
          </p>
        </div>

        {isCard && (
          <>
            <div className="md:col-span-1">
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Kart Satış Tutarı
              </label>
              <input
                type="text"
                value={cardSaleTotal}
                onChange={(e) =>
                  onChangeCardSaleTotal(e.target.value)
                }
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Örn. 80.000"
              />
            </div>
            <div className="md:col-span-1">
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Komisyon (%)
              </label>
              <input
                type="text"
                value={cardFeeRate}
                onChange={(e) =>
                  onChangeCardFeeRate(e.target.value)
                }
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Örn. 3.5"
              />
            </div>
            <div className="md:col-span-1">
              <p className="text-[11px] text-slate-500">
                Kartla yapılan satışlarda bu bilgilerden kart komisyonu
                hesaplanır. Nakit / Tim / Sivantos / Senet
                seçeneklerinde bu alanlar kullanılmaz.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
