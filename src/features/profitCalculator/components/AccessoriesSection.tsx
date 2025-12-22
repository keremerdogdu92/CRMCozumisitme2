// src/features/profitCalculator/components/AccessoriesSection.tsx
// Summary: Accessory cost inputs and charger quick-add for the Profit Calculator.

import React from "react";
import type { AccessoryRow, DeviceModelOption } from "../types";

type AccessoriesSectionProps = {
  accessories: AccessoryRow[];
  chargerModels: DeviceModelOption[];
  selectedChargerModel: string;
  accessoriesTotal: number;
  onSelectedChargerModelChange: (value: string) => void;
  onAddChargerFromSelection: () => void;
  onAddAccessoryRow: () => void;
  onUpdateAccessoryRow: (id: string, patch: Partial<AccessoryRow>) => void;
  onRemoveAccessoryRow: (id: string) => void;
};

export const AccessoriesSection: React.FC<AccessoriesSectionProps> = ({
  accessories,
  chargerModels,
  selectedChargerModel,
  accessoriesTotal,
  onSelectedChargerModelChange,
  onAddChargerFromSelection,
  onAddAccessoryRow,
  onUpdateAccessoryRow,
  onRemoveAccessoryRow,
}) => {
  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">
        3. Aksesuar Maliyeti
      </h2>
      <p className="text-xs text-slate-700">
        Müşteri toplam fiyatı soruyor, aksesuarlar ayrıca fiyatlanmıyor.
        Burada sadece bu satışa ait aksesuar{" "}
        <span className="font-semibold">maliyetlerini</span> ekle.
      </p>

      {/* Charger quick-add from price list */}
      <div className="grid items-end grid-cols-12 gap-2">
        <div className="col-span-9 md:col-span-10">
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Şarj aleti hızlı ekleme (listeye kayıtlı olanlar)
          </label>
          <select
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={selectedChargerModel}
            onChange={(e) => onSelectedChargerModelChange(e.target.value)}
          >
            <option value="">Seçilmedi</option>
            {chargerModels.map((c) => (
              <option key={`${c.brand ?? ""}-${c.model}`} value={c.model}>
                {c.brand ? `${c.brand.trim()} - ${c.model}` : c.model}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-3 md:col-span-2">
          <button
            type="button"
            className="w-full rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onAddChargerFromSelection}
            disabled={!selectedChargerModel}
          >
            + Ekle
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {accessories.map((acc) => (
          <div
            key={acc.id}
            className="grid grid-cols-12 items-center gap-2 text-sm"
          >
            <input
              className="col-span-4 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Ad (isteğe bağlı)"
              value={acc.name}
              onChange={(e) =>
                onUpdateAccessoryRow(acc.id, { name: e.target.value })
              }
            />
            <input
              type="number"
              min={0}
              step={1}
              className="col-span-3 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Birim maliyet"
              value={acc.unitCost}
              onChange={(e) =>
                onUpdateAccessoryRow(acc.id, {
                  unitCost: Number(e.target.value || 0),
                })
              }
            />
            <input
              type="number"
              min={1}
              step={1}
              className="col-span-2 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Adet"
              value={acc.quantity}
              onChange={(e) =>
                onUpdateAccessoryRow(acc.id, {
                  quantity: Number(e.target.value || 0),
                })
              }
            />
            <div className="col-span-2 text-right text-sm text-slate-800">
              {(acc.unitCost * acc.quantity || 0).toLocaleString("tr-TR", {
                maximumFractionDigits: 2,
              })}{" "}
              TL
            </div>
            <button
              type="button"
              className="col-span-1 text-xs text-red-600 hover:underline"
              onClick={() => onRemoveAccessoryRow(acc.id)}
            >
              Sil
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-800 hover:bg-slate-50"
        onClick={onAddAccessoryRow}
      >
        + Aksesuar satırı ekle
      </button>

      <div className="mt-2 text-sm text-slate-800">
        Toplam aksesuar maliyeti:{" "}
        <span className="font-semibold">
          {accessoriesTotal.toLocaleString("tr-TR", {
            maximumFractionDigits: 2,
          })}{" "}
          TL
        </span>
      </div>
    </section>
  );
};
