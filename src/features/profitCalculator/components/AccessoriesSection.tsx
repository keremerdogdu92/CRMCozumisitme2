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
    <section className="border rounded-lg p-4 space-y-4">
      <h2 className="font-semibold">3. Aksesuar Maliyeti</h2>
      <p className="text-sm text-gray-700">
        Müşteri toplam fiyatı soruyor, aksesuarlar ayrıca fiyatlanmıyor. Burada
        sadece bu satışa ait aksesuar{" "}
        <span className="font-semibold">maliyetlerini</span> ekle.
      </p>

      {/* Charger quick-add from price list */}
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-9 md:col-span-10">
          <label className="block text-sm font-medium mb-1">
            Şarj aleti hızlı ekleme (listeye kayıtlı olanlar)
          </label>
          <select
            className="w-full border rounded px-2 py-1 text-sm"
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
            className="w-full text-sm px-3 py-1 border rounded"
            onClick={onAddChargerFromSelection}
            disabled={!selectedChargerModel}
          >
            + Ekle
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {accessories.map((acc) => (
          <div key={acc.id} className="grid grid-cols-12 gap-2 items-center">
            <input
              className="col-span-4 border rounded px-2 py-1 text-sm"
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
              className="col-span-3 border rounded px-2 py-1 text-sm"
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
              className="col-span-2 border rounded px-2 py-1 text-sm"
              placeholder="Adet"
              value={acc.quantity}
              onChange={(e) =>
                onUpdateAccessoryRow(acc.id, {
                  quantity: Number(e.target.value || 0),
                })
              }
            />
            <div className="col-span-2 text-sm text-right">
              {(acc.unitCost * acc.quantity || 0).toLocaleString("tr-TR", {
                maximumFractionDigits: 2,
              })}{" "}
              TL
            </div>
            <button
              type="button"
              className="col-span-1 text-xs text-red-600"
              onClick={() => onRemoveAccessoryRow(acc.id)}
            >
              Sil
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="text-sm px-3 py-1 border rounded"
        onClick={onAddAccessoryRow}
      >
        + Aksesuar satırı ekle
      </button>

      <div className="text-sm mt-2">
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
