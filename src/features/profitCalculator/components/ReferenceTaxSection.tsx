// src/features/profitCalculator/components/ReferenceTaxSection.tsx
// Summary: Reference selection and income tax configuration for the Profit Calculator.

import React from "react";
import type { ProfitCalcInputs, ReferenceOption, ReferenceScheme } from "../types";

type ReferenceTaxSectionProps = {
  inputs: ProfitCalcInputs;
  references: ReferenceOption[];
  onChange: <K extends keyof ProfitCalcInputs>(
    key: K,
    value: ProfitCalcInputs[K]
  ) => void;
  onReferenceChange: (id: string | null) => void;
};

export const ReferenceTaxSection: React.FC<ReferenceTaxSectionProps> = ({
  inputs,
  references,
  onChange,
  onReferenceChange,
}) => {
  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">
        2. Referans ve Vergi
      </h2>
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Referans (isteğe bağlı)
          </label>
          <select
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={inputs.selectedReferenceId ?? ""}
            onChange={(e) =>
              onReferenceChange(e.target.value ? e.target.value : null)
            }
          >
            <option value="">Seçilmedi</option>
            {references.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Referans tipi
          </label>
          <select
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={inputs.referenceScheme ?? ""}
            onChange={(e) =>
              onChange("referenceScheme", (e.target.value || null) as ReferenceScheme)
            }
          >
            <option value="">Yok</option>
            <option value="percent">% (satıştan)</option>
            <option value="fixed">Sabit (TL)</option>
          </select>
        </div>

        {inputs.referenceScheme === "percent" ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Referans oranı (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={inputs.referencePercent * 100}
              onChange={(e) =>
                onChange(
                  "referencePercent",
                  Number(e.target.value || 0) / 100
                )
              }
            />
          </div>
        ) : inputs.referenceScheme === "fixed" ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Referans tutarı (TL)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={inputs.referenceFixed}
              onChange={(e) =>
                onChange("referenceFixed", Number(e.target.value || 0))
              }
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Gelir vergisi oranı (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={inputs.taxRate * 100}
            onChange={(e) =>
              onChange("taxRate", Number(e.target.value || 0) / 100)
            }
          />
          <p className="mt-1 text-xs text-slate-600">
            KDV hesaplanmaz (işitme cihazı KDV&apos;den muaftır). Vergi sadece
            gelir vergisi olarak düşünülür.
          </p>
        </div>
      </div>
    </section>
  );
};
