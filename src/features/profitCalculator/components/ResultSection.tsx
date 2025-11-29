// src/features/profitCalculator/components/ResultSection.tsx
// Summary: Final profitability breakdown display for the Profit Calculator.

import React from "react";
import type { ProfitCalcResult } from "../types";

type ResultSectionProps = {
  result: ProfitCalcResult | null;
  totalDeviceCost: number | null;
};

export const ResultSection: React.FC<ResultSectionProps> = ({
  result,
  totalDeviceCost,
}) => {
  return (
    <section className="border rounded-lg p-4 space-y-4">
      <h2 className="font-semibold">5. Sonuç</h2>

      {totalDeviceCost == null && (
        <p className="text-sm text-red-600">
          Hesaplama için önce cihaz modeli ve geçerli bir maliyet seçmelisin.
        </p>
      )}

      {result && result.error && (
        <p className="text-sm text-red-600">{result.error}</p>
      )}

      {result && !result.error && result.valid && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">Önerilen Satış Fiyatı:</span>{" "}
                <span className="font-semibold">
                  {result.salePrice.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  TL
                </span>
              </div>
              <div>
                <span className="font-medium">Net Kâr:</span>{" "}
                <span className="font-semibold">
                  {result.netProfit.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  TL
                </span>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <div>
                K / (Cihaz + aksesuar maliyeti):{" "}
                <span className="font-semibold">
                  {(result.profitOverCost * 100).toFixed(1)} %
                </span>
              </div>
              <div>
                K / Ciro:{" "}
                <span className="font-semibold">
                  {(result.profitOverRevenue * 100).toFixed(1)} %
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t pt-4 text-sm space-y-1">
            <div>
              Cihaz maliyeti (C):{" "}
              {result.deviceCost.toLocaleString("tr-TR", {
                maximumFractionDigits: 2,
              })}{" "}
              TL
            </div>
            <div>
              Aksesuar maliyeti (Ac):{" "}
              {result.accessoriesCost.toLocaleString("tr-TR", {
                maximumFractionDigits: 2,
              })}{" "}
              TL
            </div>
            <div>
              Toplam maliyet (C + Ac):{" "}
              {result.totalCost.toLocaleString("tr-TR", {
                maximumFractionDigits: 2,
              })}{" "}
              TL
            </div>
            <div>
              Referans komisyonu (R):{" "}
              {result.referenceCommission.toLocaleString("tr-TR", {
                maximumFractionDigits: 2,
              })}{" "}
              TL
            </div>
            <div>
              Gelir vergisi (T):{" "}
              {result.taxAmount.toLocaleString("tr-TR", {
                maximumFractionDigits: 2,
              })}{" "}
              TL
            </div>
            {result.listPriceTotal != null && (
              <>
                <div>
                  Liste fiyatı (toplam):{" "}
                  {result.listPriceTotal.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  TL
                </div>
                {result.discountAmount != null &&
                  result.discountPercent != null && (
                    <div>
                      Listeye göre indirim:{" "}
                      {result.discountAmount.toLocaleString("tr-TR", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      TL{" "}
                      <span className="text-gray-700">
                        ({result.discountPercent.toFixed(1)} %)
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
