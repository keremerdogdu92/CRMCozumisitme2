// src/features/profitCalculator/components/DeviceSection.tsx
// Summary: Brand/model/date selection and device cost summary for the Profit Calculator.

import React from "react";
import type { ProfitCalcInputs, DeviceModelOption } from "../types";

type DeviceSectionProps = {
  inputs: ProfitCalcInputs;
  brandOptions: string[];
  filteredModels: DeviceModelOption[];
  deviceUnitCost: number | null;
  deviceCostLoading: boolean;
  totalDeviceCost: number | null;
  showDate: boolean;
  onToggleDate: () => void;
  onChange: <K extends keyof ProfitCalcInputs>(
    key: K,
    value: ProfitCalcInputs[K]
  ) => void;
  onBrandChange: (brand: string) => void;
};

export const DeviceSection: React.FC<DeviceSectionProps> = ({
  inputs,
  brandOptions,
  filteredModels,
  deviceUnitCost,
  deviceCostLoading,
  totalDeviceCost,
  showDate,
  onToggleDate,
  onChange,
  onBrandChange,
}) => {
  return (
    <section className="border rounded-lg p-4 space-y-4">
      <h2 className="font-semibold">1. Cihaz</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Marka</label>
          <select
            className="w-full border rounded px-2 py-1 text-sm"
            value={inputs.selectedBrand}
            onChange={(e) => onBrandChange(e.target.value)}
          >
            <option value="">Tümü</option>
            {brandOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Cihaz modeli
          </label>
          <select
            className="w-full border rounded px-2 py-1 text-sm"
            value={inputs.selectedModel}
            onChange={(e) => onChange("selectedModel", e.target.value)}
          >
            <option value="">Seçiniz</option>
            {filteredModels.map((m) => (
              <option key={`${m.brand ?? ""}-${m.model}`} value={m.model}>
                {m.brand ? `${m.brand.trim()} - ${m.model}` : m.model}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Cihaz adedi
          </label>
          <input
            type="number"
            min={1}
            max={4}
            step={1}
            className="w-full border rounded px-2 py-1 text-sm"
            value={inputs.deviceQuantity}
            onChange={(e) =>
              onChange(
                "deviceQuantity",
                Math.max(1, Number(e.target.value || 1))
              )
            }
          />
          <p className="text-xs text-gray-600 mt-1">
            Çoğu durumda 2 (sağ + sol kulak).
          </p>
        </div>
      </div>

      <button
        type="button"
        className="mt-2 text-xs text-blue-700 underline"
        onClick={onToggleDate}
      >
        Tarih ayarını {showDate ? "gizle" : "göster"} (opsiyonel)
      </button>

      {showDate && (
        <div className="mt-2 max-w-xs">
          <label className="block text-sm font-medium mb-1">
            Tarih (şimdilik sadece bilgi amaçlı)
          </label>
          <input
            type="date"
            className="w-full border rounded px-2 py-1 text-sm"
            value={inputs.asOfDate}
            onChange={(e) => onChange("asOfDate", e.target.value)}
          />
        </div>
      )}

      <div className="text-sm mt-2">
        {deviceCostLoading ? (
          <span>Cihaz maliyeti yükleniyor...</span>
        ) : totalDeviceCost == null ? (
          <span className="text-red-600">
            Seçilen cihaz için maliyet bulunamadı (listeye{" "}
            <span className="font-semibold">purchase_price</span> ve
            tercihen <span className="font-semibold">list_price</span> ekli
            mi?).
          </span>
        ) : (
          <span>
            Cihaz maliyeti (C):{" "}
            <span className="font-semibold">
              {totalDeviceCost.toLocaleString("tr-TR", {
                maximumFractionDigits: 2,
              })}{" "}
              TL
            </span>
            {deviceUnitCost != null && (
              <>
                {" "}
                <span className="text-gray-600">
                  (adet başı{" "}
                  {deviceUnitCost.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  TL)
                </span>
              </>
            )}
          </span>
        )}
      </div>
    </section>
  );
};
