// src/features/profitCalculator/ProfitCalculatorForm.tsx
// Summary: React UI composition for the Profitability Calculator.
// Uses current_device_model_prices_public for device & charger prices.
// State, side-effects, and calculation logic are delegated to useProfitCalculatorForm + ./logic.
// v2: Added optional credit-card commission viewer using the same
//     installment/commission logic as NewPatientPaymentSection.

import React, { useMemo, useState } from "react";
import { useProfitCalculatorForm } from "./hooks/useProfitCalculatorForm";
import { DeviceSection } from "./components/DeviceSection";
import { ReferenceTaxSection } from "./components/ReferenceTaxSection";
import { AccessoriesSection } from "./components/AccessoriesSection";
import { ModeSection } from "./components/ModeSection";
import { ResultSection } from "./components/ResultSection";

// -----------------------------
// Card commission helpers
// -----------------------------

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
// Not: NewPatientPaymentSection ile aynı tarih tutuluyor.
const COMMISSION_RATE_SWITCH_DATE_ISO = "2026-03-01";

function shouldUseFinalRates(): boolean {
  const now = new Date();
  const switchDate = new Date(`${COMMISSION_RATE_SWITCH_DATE_ISO}T00:00:00`);
  return now >= switchDate;
}

function getRateForInstallments(count: number): number | null {
  const row = INSTALLMENT_RATES.find((r) => r.installments === count);
  if (!row) return null;
  return shouldUseFinalRates() ? row.finalRate : row.welcomeRate;
}

// "2,69" -> 2.69
function parsePercentLike(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(",", ".");
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return num;
}

// Basit TRY formatlayıcı.
function formatCurrencyTry(amount: number | null): string {
  if (amount == null) return "-";
  try {
    return amount.toLocaleString("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${amount}`;
  }
}

type PaymentMethodForCommission = "" | "Nakit" | "Kredi_Kartı";

export const ProfitCalculatorForm: React.FC = () => {
  const {
    // state & derived
    loading,
    inputs,
    deviceUnitCost,
    deviceCostLoading,
    showDate,
    setShowDate,
    brandOptions,
    filteredModels,
    references,
    chargerModels,
    selectedChargerModel,
    setSelectedChargerModel,
    result,
    totalDeviceCost,
    accessoriesTotal,

    // handlers
    handleChange,
    handleBrandChange,
    handleReferenceChange,
    addAccessoryRow,
    addChargerFromSelection,
    updateAccessoryRow,
    removeAccessoryRow,
  } = useProfitCalculatorForm();

  // -----------------------------
  // Local state for card commission preview
  // -----------------------------
  const [paymentMethodForCommission, setPaymentMethodForCommission] =
    useState<PaymentMethodForCommission>("");
  const [selectedInstallment, setSelectedInstallment] = useState<string>("");
  const [cardFeeRate, setCardFeeRate] = useState<string>("");

  const isCard = paymentMethodForCommission === "Kredi_Kartı";

  const handlePaymentMethodChange = (value: PaymentMethodForCommission) => {
    setPaymentMethodForCommission(value);
    if (value !== "Kredi_Kartı") {
      setSelectedInstallment("");
      setCardFeeRate("");
    }
  };

  const handleInstallmentChange = (value: string) => {
    setSelectedInstallment(value);
    const count = Number(value);
    const rate = Number.isFinite(count)
      ? getRateForInstallments(count)
      : null;

    if (rate != null) {
      // virgüllü gösterim aynı kalsın
      setCardFeeRate(rate.toString().replace(".", ","));
    } else {
      setCardFeeRate("");
    }
  };

  const { feeAmount, netAmount } = useMemo(() => {
    if (!result || !result.salePrice || !isCard) {
      return { feeAmount: null, netAmount: null };
    }
    const rate = parsePercentLike(cardFeeRate);
    if (rate == null || rate <= 0) {
      return { feeAmount: null, netAmount: null };
    }

    const sale = result.salePrice;
    const fee = Number((sale * (rate / 100)).toFixed(2));
    const net = Number((sale - fee).toFixed(2));

    return { feeAmount: fee, netAmount: net };
  }, [result, cardFeeRate, isCard]);

  if (loading) {
    return <div className="p-4">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Karlılık Hesaplama Aracı</h1>

      <DeviceSection
        inputs={inputs}
        brandOptions={brandOptions}
        filteredModels={filteredModels}
        deviceUnitCost={deviceUnitCost}
        deviceCostLoading={deviceCostLoading}
        totalDeviceCost={totalDeviceCost}
        showDate={showDate}
        onToggleDate={() => setShowDate((v) => !v)}
        onChange={handleChange}
        onBrandChange={handleBrandChange}
      />

      <ReferenceTaxSection
        inputs={inputs}
        references={references}
        onChange={handleChange}
        onReferenceChange={handleReferenceChange}
      />

      <AccessoriesSection
        accessories={inputs.accessories}
        chargerModels={chargerModels}
        selectedChargerModel={selectedChargerModel}
        accessoriesTotal={accessoriesTotal}
        onSelectedChargerModelChange={setSelectedChargerModel}
        onAddChargerFromSelection={addChargerFromSelection}
        onAddAccessoryRow={addAccessoryRow}
        onUpdateAccessoryRow={updateAccessoryRow}
        onRemoveAccessoryRow={removeAccessoryRow}
      />

      <ModeSection inputs={inputs} onChange={handleChange} />

      <ResultSection result={result} totalDeviceCost={totalDeviceCost} />

      {/* Kart komisyonu önizleme bölümü */}
      {result && result.salePrice > 0 && (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-800">
            Ödeme ve Kart Komisyonu (opsiyonel)
          </p>
          <p className="text-[11px] text-slate-600">
            Hesaplanan satış fiyatı üzerinden kredi kartı komisyonunu
            önceden görebilirsiniz. Bu bölüm sadece bilgi amaçlıdır;
            yukarıdaki kârlılık hesabını değiştirmez.
          </p>

          <div className="grid gap-2 md:grid-cols-4 md:items-end">
            {/* Ödeme şekli */}
            <div className="md:col-span-1">
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Ödeme Şekli
              </label>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={paymentMethodForCommission}
                onChange={(e) =>
                  handlePaymentMethodChange(
                    e.target.value as PaymentMethodForCommission
                  )
                }
              >
                <option value="">Seçilmedi</option>
                <option value="Nakit">Nakit</option>
                <option value="Kredi_Kartı">Kredi Kartı</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Buradaki seçim sadece simülasyon içindir; hasta kaydını
                etkilemez.
              </p>
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
                    Taksit seçimine göre otomatik dolar; oranlar hasta
                    formundaki tabloyla aynıdır.
                  </p>
                </div>

                <div className="md:col-span-4 mt-2">
                  <p className="text-[11px] text-slate-600">
                    Komisyon:{" "}
                    <span className="font-semibold">
                      {formatCurrencyTry(feeAmount)}
                    </span>{" "}
                    – Komisyon sonrası net tahsilat:{" "}
                    <span className="font-semibold">
                      {formatCurrencyTry(netAmount)}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Satış fiyatı:{" "}
                    <span className="font-semibold">
                      {formatCurrencyTry(result.salePrice)}
                    </span>
                    . Kart komisyonu, bu tutar üzerinden hesaplanır.
                  </p>
                </div>
              </>
            )}

            {!isCard && (
              <div className="md:col-span-3">
                <p className="text-[11px] text-slate-500">
                  Kart komisyonu yalnızca &quot;Kredi Kartı&quot; seçiliyse
                  ve yukarıda satış fiyatı hesaplanmışsa gösterilir.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
