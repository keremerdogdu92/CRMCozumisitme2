// src/features/profitCalculator/components/ResultSection.tsx
// Summary: Final profitability breakdown display for the Profit Calculator.
// Shows a single unified breakdown. If a cardFee is provided, it is treated
// as an extra expense: net profit and profit ratios are shown *after* card
// commission, while also displaying the underlying pre-card numbers.

import React from "react";
import type { ProfitCalcResult } from "../types";

type ResultSectionProps = {
  result: ProfitCalcResult | null;
  totalDeviceCost: number | null;
  cardFee?: number | null; // ekstra kart komisyonu (TL) varsa buradan gelir
};

export const ResultSection: React.FC<ResultSectionProps> = ({
  result,
  totalDeviceCost,
  cardFee,
}) => {
  const hasResult = !!result && result.valid && !result.error;

  const effectiveCardFee =
    cardFee != null && cardFee > 0 ? cardFee : 0;

  const salePrice = hasResult ? result!.salePrice : 0;
  const totalCost = hasResult ? result!.totalCost : 0;
  const baseNetProfit = hasResult ? result!.netProfit : 0;

  // Kart komisyonu gider olarak düşüldükten sonraki net kâr:
  const netProfitAfterCard = baseNetProfit - effectiveCardFee;

  const profitOverCostAfterCard =
    hasResult && totalCost > 0
      ? netProfitAfterCard / totalCost
      : 0;

  const profitOverRevenueAfterCard =
    hasResult && salePrice > 0
      ? netProfitAfterCard / salePrice
      : 0;

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">6. Sonuç</h2>

      {totalDeviceCost == null && (
        <p className="text-sm text-red-600">
          Hesaplama için önce cihaz modeli ve geçerli bir maliyet seçmelisin.
        </p>
      )}

      {result && result.error && (
        <p className="text-sm text-red-600">{result.error}</p>
      )}

      {hasResult && (
        <>
          {/* Özet kısım: satış fiyatı + kart sonrası net kâr ve oranlar */}
          <div className="grid grid-cols-1 gap-4 text-sm text-slate-800 md:grid-cols-2">
            <div className="space-y-1">
              <div>
                <span className="font-medium">Önerilen Satış Fiyatı:</span>{" "}
                <span className="font-semibold">
                  {salePrice.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  TL
                </span>
              </div>
              <div>
                <span className="font-medium">
                  Net Kâr
                  {effectiveCardFee > 0 ? " (kart sonrası)" : ""}:
                </span>{" "}
                <span className="font-semibold">
                  {netProfitAfterCard.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  TL
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div>
                K / (Cihaz + aksesuar maliyeti)
                {effectiveCardFee > 0 ? " (kart sonrası)" : ""}:{" "}
                <span className="font-semibold">
                  {(profitOverCostAfterCard * 100).toFixed(1)} %
                </span>
              </div>
              <div>
                K / Ciro
                {effectiveCardFee > 0 ? " (kart sonrası)" : ""}:{" "}
                <span className="font-semibold">
                  {(profitOverRevenueAfterCard * 100).toFixed(1)} %
                </span>
              </div>
            </div>
          </div>

          {/* Detaylı döküm */}
          <div className="mt-4 space-y-1 border-t pt-4 text-sm text-slate-800">
            <div>
              Cihaz maliyeti (C):{" "}
              {result!.deviceCost.toLocaleString("tr-TR", {
                maximumFractionDigits: 2,
              })}{" "}
              TL
            </div>
            <div>
              Aksesuar maliyeti (Ac):{" "}
              {result!.accessoriesCost.toLocaleString("tr-TR", {
                maximumFractionDigits: 2,
              })}{" "}
              TL
            </div>
            <div>
              Toplam maliyet (C + Ac):{" "}
              {totalCost.toLocaleString("tr-TR", {
                maximumFractionDigits: 2,
              })}{" "}
              TL
            </div>
            <div>
              Referans komisyonu (R):{" "}
              {result!.referenceCommission.toLocaleString("tr-TR", {
                maximumFractionDigits: 2,
              })}{" "}
              TL
            </div>
            <div>
              Gelir vergisi (T):{" "}
              {result!.taxAmount.toLocaleString("tr-TR", {
                maximumFractionDigits: 2,
              })}{" "}
              TL
            </div>

            {/* Kart komisyonu satırı (varsa) + kart öncesi net kâr bilgisi */}
            {effectiveCardFee > 0 && (
              <>
                <div>
                  Kart komisyonu (ekstra gider):{" "}
                  {effectiveCardFee.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  TL
                </div>
                <div className="text-xs text-slate-600">
                  Net kâr (kart öncesi):{" "}
                  {baseNetProfit.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  TL &rarr; Net kâr (kart sonrası):{" "}
                  {netProfitAfterCard.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  TL
                </div>
              </>
            )}

            {result!.listPriceTotal != null && (
              <>
                <div>
                  Liste fiyatı (toplam):{" "}
                  {result!.listPriceTotal!.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  TL
                </div>
                {result!.discountAmount != null &&
                  result!.discountPercent != null && (
                    <div>
                      Listeye göre indirim:{" "}
                      {result!.discountAmount!.toLocaleString("tr-TR", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      TL{" "}
                      <span className="text-slate-700">
                        ({result!.discountPercent!.toFixed(1)} %)
                      </span>
                    </div>
                  )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
};
