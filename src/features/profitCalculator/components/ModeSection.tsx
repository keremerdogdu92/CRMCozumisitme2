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
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">
        5. Hesaplama Modu
      </h2>

      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          className={
            "rounded-md border px-3 py-1 " +
            (inputs.mode === "price"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white text-slate-800")
          }
          onClick={() => setMode("price")}
        >
          Satış fiyatını gir
        </button>
        <button
          type="button"
          className={
            "rounded-md border px-3 py-1 " +
            (inputs.mode === "targetOnCost"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white text-slate-800")
          }
          onClick={() => setMode("targetOnCost")}
        >
          Cihaza göre % hedef
        </button>
        <button
          type="button"
          className={
            "rounded-md border px-3 py-1 " +
            (inputs.mode === "targetOnRevenue"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white text-slate-800")
          }
          onClick={() => setMode("targetOnRevenue")}
        >
          Ciroya göre % hedef
        </button>
      </div>

      {inputs.mode === "price" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Satış fiyatı (TL)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Cihaza göre kâr hedefi (%)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={inputs.targetOnCostPercent * 100}
              onChange={(e) =>
                onChange(
                  "targetOnCostPercent",
                  Number(e.target.value || 0) / 100
                )
              }
            />
            <p className="mt-1 text-xs text-slate-600">
              Örnek: %100 girersen, net kâr Cihaz+aksesuar toplam maliyetine
              eşit olsun demektir.
            </p>
          </div>
        </div>
      )}

      {inputs.mode === "targetOnRevenue" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Ciroya göre kâr hedefi (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={inputs.targetOnRevenuePercent * 100}
              onChange={(e) =>
                onChange(
                  "targetOnRevenuePercent",
                  Number(e.target.value || 0) / 100
                )
              }
            />
            <p className="mt-1 text-xs text-slate-600">
              Örnek: %20 girersen, net kârın satış fiyatının %20&apos;si
              olmasını hedeflersin.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
