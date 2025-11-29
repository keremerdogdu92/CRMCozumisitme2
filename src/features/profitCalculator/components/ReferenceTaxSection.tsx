// src/features/profitCalculator/components/ReferenceTaxSection.tsx
// Summary: Reference selection and income tax configuration for the Profit Calculator.

import React from "react";
import type { ProfitCalcInputs, ReferenceOption } from "../types";

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
    <section className="border rounded-lg p-4 space-y-4">
      <h2 className="font-semibold">2. Referans ve Vergi</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">
            Referans (isteğe bağlı)
          </label>
          <select
            className="w-full border rounded px-2 py-1 text-sm"
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
          <label className="block text-sm font-medium mb-1">
            Referans tipi
          </label>
          <select
            className="w-full border rounded px-2 py-1 text-sm"
            value={inputs.referenceScheme ?? ""}
            onChange={(e) =>
              onChange("referenceScheme", (e.target.value || null) as any)
            }
          >
            <option value="">Yok</option>
            <option value="percent">% (satıştan)</option>
            <option value="fixed">Sabit (TL)</option>
          </select>
        </div>

        {inputs.referenceScheme === "percent" ? (
          <div>
            <label className="block text-sm font-medium mb-1">
              Referans oranı (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              className="w-full border rounded px-2 py-1 text-sm"
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
            <label className="block text-sm font-medium mb-1">
              Referans tutarı (TL)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              className="w-full border rounded px-2 py-1 text-sm"
              value={inputs.referenceFixed}
              onChange={(e) =>
                onChange("referenceFixed", Number(e.target.value || 0))
              }
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Gelir vergisi oranı (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            className="w-full border rounded px-2 py-1 text-sm"
            value={inputs.taxRate * 100}
            onChange={(e) =>
              onChange("taxRate", Number(e.target.value || 0) / 100)
            }
          />
          <p className="text-xs text-gray-600 mt-1">
            KDV hesaplanmaz (işitme cihazı KDV’den muaftır). Vergi sadece gelir
            vergisi olarak düşünülür.
          </p>
        </div>
      </div>
    </section>
  );
};
