// src/features/profitCalculator/components/ModeSection.tsx
// Summary: Calculation mode selector and mode-specific inputs for the Profit Calculator.

import React from "react";
import type { ProfitCalcInputs, ProfitCalcMode } from "../types";

type ModeSectionProps = {
  inputs: ProfitCalcInputs;
  onChange: <K extends keyof ProfitCalcInputs>(
    key: K,
    value: ProfitCalcInputs[K]
  ) => void;
};

export const ModeSection: React.FC<ModeSectionProps> = ({
  inputs,
  onChange,
}) => {
  const setMode = (mode: ProfitCalcMode) => onChange("mode", mode);

  return (
    <section className="border rounded-lg p-4 space-y-4">
      <h2 className="font-semibold">4. Hesaplama Modu</h2>

      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          className={
            "px-3 py-1 border rounded " +
            (inputs.mode === "price" ? "bg-gray-900 text-white" : "bg-white")
          }
          onClick={() => setMode("price")}
        >
          Satış fiyatını gir
        </button>
        <button
          type="button"
          className={
            "px-3 py-1 border rounded " +
            (inputs.mode === "targetOnCost"
              ? "bg-gray-900 text-white"
              : "bg-white")
          }
          onClick={() => setMode("targetOnCost")}
        >
          Cihaza göre % hedef
        </button>
        <button
          type="button"
          className={
            "px-3 py-1 border rounded " +
            (inputs.mode === "targetOnRevenue"
              ? "bg-gray-900 text-white"
              : "bg-white")
          }
          onClick={() => setMode("targetOnRevenue")}
        >
          Ciroya göre % hedef
        </button>
      </div>

      {inputs.mode === "price" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Satış fiyatı (TL)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              className="w-full border rounded px-2 py-1 text-sm"
              value={inputs.salePrice ?? ""}
              onChange={(e) =>
                onChange(
                  "salePrice",
                  e.target.value ? Number(e.target.value) : null
                )
              }
            />
          </div>
        </div>
      )}

      {inputs.mode === "targetOnCost" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Cihaza göre kâr hedefi (%)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              className="w-full border rounded px-2 py-1 text-sm"
              value={inputs.targetOnCostPercent * 100}
              onChange={(e) =>
                onChange(
                  "targetOnCostPercent",
                  Number(e.target.value || 0) / 100
                )
              }
            />
            <p className="text-xs text-gray-600 mt-1">
              Örnek: %100 girersen, net kâr Cihaz+aksesuar toplam maliyetine
              eşit olsun demektir.
            </p>
          </div>
        </div>
      )}

      {inputs.mode === "targetOnRevenue" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Ciroya göre kâr hedefi (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              className="w-full border rounded px-2 py-1 text-sm"
              value={inputs.targetOnRevenuePercent * 100}
              onChange={(e) =>
                onChange(
                  "targetOnRevenuePercent",
                  Number(e.target.value || 0) / 100
                )
              }
            />
            <p className="text-xs text-gray-600 mt-1">
              Örnek: %20 girersen, net kârın satış fiyatının %20&apos;si
              olmasını hedeflersin.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
