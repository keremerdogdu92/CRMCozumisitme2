// src/features/patients/components/new/NewPatientPaymentSection.tsx
// Payment method selector and sale total + optional card details for new patient form.
//
// v2 rules:
// - Total sale amount (devices + accessories, real sale) is required for all payment types.
// - If "Kredi Kartı" is selected:
//   * Installment (physical POS) is selected.
//   * Commission rate is auto-filled from table and input is read-only.
//   * Commission amount and net amount are calculated from total sale + commission rate.
//
// Ödeme yöntemi seçici + toplam tutar ve opsiyonel kart detayları.

import { useMemo, useState } from 'react';
import type { PatientPaymentMethodFormValue } from '../../types';

const PAYMENT_METHOD_OPTIONS: {
  value: PatientPaymentMethodFormValue;
  label: string;
}[] = [
  { value: '', label: 'Ödeme Seçiniz' },
  { value: 'Tim', label: 'Tim' },
  { value: 'Sivantos', label: 'Sivantos' },
  { value: 'Kredi_Kartı', label: 'Kredi Kartı' },
  { value: 'Nakit', label: 'Nakit' },
  { value: 'Senet', label: 'Senet' },
];

// Fiziki POS komisyon tabloları (yüzde).
// Column 2: "3 Ekim sonrası (Hoş Geldin ilk 3 ay)"
// Column 3: "Kampanya süresi sonunda".
type InstallmentRateRow = {
  installments: number;
  welcomeRate: number; // 3 Ekim sonrası
  finalRate: number; // Kampanya sonunda
};

const INSTALLMENT_RATES: InstallmentRateRow[] = [
  { installments: 1, welcomeRate: 2.69, finalRate: 2.99 },
  { installments: 2, welcomeRate: 6.99, finalRate: 7.49 },
  { installments: 3, welcomeRate: 8.99, finalRate: 9.29 },
  { installments: 4, welcomeRate: 10.89, finalRate: 11.29 },
  { installments: 6, welcomeRate: 14.59, finalRate: 14.99 },
  { installments: 9, welcomeRate: 19.99, finalRate: 20.49 },
  { installments: 12, welcomeRate: 25.49, finalRate: 25.99 },
];

// Hangi tarihte final oranlara geçileceği.
const COMMISSION_RATE_SWITCH_DATE_ISO = '2026-03-01';

function shouldUseFinalRates(): boolean {
  const now = new Date();
  const switchDate = new Date(
    `${COMMISSION_RATE_SWITCH_DATE_ISO}T00:00:00`,
  );
  return now >= switchDate;
}

function getRateForInstallments(count: number): number | null {
  const row = INSTALLMENT_RATES.find((r) => r.installments === count);
  if (!row) return null;
  return shouldUseFinalRates() ? row.finalRate : row.welcomeRate;
}

// Basit para parse fonksiyonu: "80.000,50" -> 80000.5
function parseMoneyLikeToNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return num;
}

// Yüzde parse: "2.69" veya "2,69" -> 2.69
function parsePercentLike(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(',', '.');
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return num;
}

// Basit TRY formatlayıcı.
function formatCurrencyTry(amount: number | null): string {
  if (amount == null) return '-';
  try {
    return amount.toLocaleString('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${amount}`;
  }
}

type NewPatientPaymentSectionProps = {
  paymentMethod: PatientPaymentMethodFormValue;
  saleTotal: string;
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
  const [selectedInstallment, setSelectedInstallment] =
    useState<string>('');

  const isCard = paymentMethod === 'Kredi_Kartı';

  const handlePaymentMethodChange = (
    value: PatientPaymentMethodFormValue,
  ) => {
    onChangePaymentMethod(value);
    if (value !== 'Kredi_Kartı') {
      setSelectedInstallment('');
      onChangeCardFeeRate('');
    }
  };

  const handleInstallmentChange = (value: string) => {
    setSelectedInstallment(value);
    const count = Number(value);
    const rate = Number.isFinite(count)
      ? getRateForInstallments(count)
      : null;

    if (rate != null) {
      onChangeCardFeeRate(rate.toString().replace('.', ','));
    } else {
      onChangeCardFeeRate('');
    }
  };

  const { feeAmount, netAmount } = useMemo(() => {
    const sale = parseMoneyLikeToNumber(saleTotal);
    const rate = parsePercentLike(cardFeeRate);

    if (sale == null || rate == null || rate <= 0) {
      return { feeAmount: null, netAmount: null };
    }

    const fee = Number((sale * (rate / 100)).toFixed(2));
    const net = Number((sale - fee).toFixed(2));
    return { feeAmount: fee, netAmount: net };
  }, [saleTotal, cardFeeRate]);

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
      <label className="mb-1 block text-xs font-medium text-slate-600">
        Ödeme Şekli ve Tutar
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
            required
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

        {/* Toplam satış tutarı (her yöntem için zorunlu) */}
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
            required
          />
        </div>

        {/* Kart seçiliyse: taksit + komisyon */}
        {isCard && (
          <>
            <div className="md:col-span-1">
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Taksit (Fiziki POS)
              </label>
              <select
                value={selectedInstallment}
                onChange={(e) =>
                  handleInstallmentChange(e.target.value)
                }
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Seçilmedi</option>
                <option value="1">1 (Tek çekim)</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="6">6</option>
                <option value="9">9</option>
                <option value="12">12</option>
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Komisyon (%)
              </label>
              <input
                type="text"
                value={cardFeeRate}
                readOnly
                className="w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-2 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Taksit seçiniz"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Taksit seçimine göre otomatik dolar; değiştirilemez. Oranlar
                banka kampanya takvimine göre tabloda saklanır.
              </p>
            </div>

            <div className="md:col-span-4 mt-2">
              <p className="text-[11px] text-slate-600">
                Komisyon:{' '}
                <span className="font-semibold">
                  {formatCurrencyTry(feeAmount)}
                </span>{' '}
                – Komisyon sonrası net:{' '}
                <span className="font-semibold">
                  {formatCurrencyTry(netAmount)}
                </span>
              </p>
            </div>
          </>
        )}

        {!isCard && (
          <div className="md:col-span-2">
            <p className="text-[11px] text-slate-500">
              Toplam satış tutarı tüm ödeme şekillerinde tutulur. Kart
              komisyonu yalnızca Kredi Kartı seçiliyse hesaplanır.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
