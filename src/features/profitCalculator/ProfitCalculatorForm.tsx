// src/features/profitCalculator/ProfitCalculatorForm.tsx
// Summary: React UI + calculation logic for the Profitability Calculator.

import React, { useEffect, useMemo, useState } from "react";
import {
  AccessoryRow,
  DeviceModelOption,
  ProfitCalcInputs,
  ProfitCalcMode,
  ProfitCalcResult,
  ReferenceOption,
} from "./types";
import {
  fetchDeviceModelOptions,
  fetchEffectiveDeviceCost,
  fetchReferenceOptions,
} from "./api";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyInputs(): ProfitCalcInputs {
  return {
    mode: "price",
    selectedModel: "",
    asOfDate: todayISO(),

    selectedReferenceId: null,
    referenceScheme: null,
    referencePercent: 0,
    referenceFixed: 0,

    taxRate: 0.15, // %15

    accessories: [],

    salePrice: null,
    targetOnCostPercent: 1.0, // %100 of cost
    targetOnRevenuePercent: 0.2, // %20 of revenue
  };
}

function calcAccessoriesCost(accessories: AccessoryRow[]): number {
  return accessories.reduce(
    (sum, acc) => sum + acc.unitCost * acc.quantity,
    0
  );
}

function calculateResult(
  inputs: ProfitCalcInputs,
  deviceCost: number | null
): ProfitCalcResult | null {
  if (deviceCost == null || deviceCost < 0) {
    return null;
  }

  const {
    mode,
    taxRate,
    referenceScheme,
    referencePercent,
    referenceFixed,
    accessories,
    salePrice,
    targetOnCostPercent,
    targetOnRevenuePercent,
  } = inputs;

  const C = deviceCost;
  const Ac = calcAccessoriesCost(accessories);
  const C_eff = C + Ac;
  const t = taxRate;

  let S: number | null = null;
  let error: string | undefined;

  if (mode === "price") {
    if (!salePrice || salePrice <= 0) {
      return null;
    }
    S = salePrice;
  } else if (mode === "targetOnCost") {
    const K = targetOnCostPercent * C_eff;

    if (referenceScheme === "percent") {
      const r = referencePercent;
      const denom = 1 - r - t;
      if (denom <= 0) {
        error =
          "Seçilen hedef + referans + vergi oranı matematiksel olarak imkânsız (1 - r - t ≤ 0).";
      } else {
        S = (K + C_eff * (1 - t)) / denom;
      }
    } else {
      const R_fixed = referenceScheme === "fixed" ? referenceFixed : 0;
      const denom = 1 - t;
      if (denom <= 0) {
        error = "Vergi oranı 100% veya üzeri. Geçerli değil.";
      } else {
        S = (K + C_eff * (1 - t) + R_fixed) / denom;
      }
    }
  } else if (mode === "targetOnRevenue") {
    const m = targetOnRevenuePercent;

    if (referenceScheme === "percent") {
      const r = referencePercent;
      const denom = 1 - r - t - m;
      if (denom <= 0) {
        error =
          "Seçilen ciroya göre kâr + referans + vergi oranları toplamı 100% veya üzeri (1 - r - t - m ≤ 0).";
      } else {
        S = (C_eff * (1 - t)) / denom;
      }
    } else {
      const R_fixed = referenceScheme === "fixed" ? referenceFixed : 0;
      const denom = 1 - t - m;
      if (denom <= 0) {
        error =
          "Seçilen ciroya göre kâr + vergi oranı toplamı 100% veya üzeri (1 - t - m ≤ 0).";
      } else {
        S = (C_eff * (1 - t) + R_fixed) / denom;
      }
    }
  }

  if (error) {
    return {
      valid: false,
      error,
      salePrice: 0,
      deviceCost: C,
      accessoriesCost: Ac,
      totalCost: C_eff,
      referenceCommission: 0,
      taxAmount: 0,
      netProfit: 0,
      profitOverCost: 0,
      profitOverRevenue: 0,
    };
  }

  if (S == null || !Number.isFinite(S) || S <= 0) {
    return null;
  }

  let R = 0;
  if (referenceScheme === "percent") {
    R = S * referencePercent;
  } else if (referenceScheme === "fixed") {
    R = referenceFixed;
  }

  const grossMargin = S - C_eff;
  const T = Math.max(grossMargin * t, 0);
  const K = S - C_eff - R - T;

  const profitOverCost = C_eff > 0 ? K / C_eff : 0;
  const profitOverRevenue = S > 0 ? K / S : 0;

  return {
    valid: true,
    salePrice: S,
    deviceCost: C,
    accessoriesCost: Ac,
    totalCost: C_eff,
    referenceCommission: R,
    taxAmount: T,
    netProfit: K,
    profitOverCost,
    profitOverRevenue,
  };
}

let accessoryIdCounter = 1;

export const ProfitCalculatorForm: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [deviceModels, setDeviceModels] = useState<DeviceModelOption[]>([]);
  const [references, setReferences] = useState<ReferenceOption[]>([]);
  const [inputs, setInputs] = useState<ProfitCalcInputs>(createEmptyInputs());
  const [deviceCost, setDeviceCost] = useState<number | null>(null);
  const [deviceCostLoading, setDeviceCostLoading] = useState(false);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [models, refs] = await Promise.all([
          fetchDeviceModelOptions(),
          fetchReferenceOptions(),
        ]);
        setDeviceModels(models);
        setReferences(refs);
      } catch (err) {
        console.error("ProfitCalculator init error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const selectedDeviceMeta = useMemo(
    () =>
      deviceModels.find((m) => m.model === inputs.selectedModel) ?? null,
    [deviceModels, inputs.selectedModel]
  );

  useEffect(() => {
    async function loadCost() {
      if (!inputs.selectedModel || !inputs.asOfDate) {
        setDeviceCost(null);
        return;
      }
      setDeviceCostLoading(true);
      try {
        const cost = await fetchEffectiveDeviceCost(
          inputs.selectedModel,
          inputs.asOfDate
        );
        setDeviceCost(cost);
      } catch (err) {
        console.error("loadCost error:", err);
        setDeviceCost(null);
      } finally {
        setDeviceCostLoading(false);
      }
    }
    loadCost();
  }, [inputs.selectedModel, inputs.asOfDate]);

  const result = useMemo(
    () => calculateResult(inputs, deviceCost),
    [inputs, deviceCost]
  );

  function handleChange<K extends keyof ProfitCalcInputs>(
    key: K,
    value: ProfitCalcInputs[K]
  ) {
    setInputs((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleDeviceModelChange(model: string) {
    const meta =
      deviceModels.find((m) => m.model === model) ?? null;

    setInputs((prev) => ({
      ...prev,
      selectedModel: model,
      // If user is in "price" mode and hasn't entered a price yet,
      // use the list price as a starting point (if available).
      salePrice:
        prev.mode === "price" &&
        prev.salePrice == null &&
        meta?.listPrice != null
          ? meta.listPrice
          : prev.salePrice,
    }));
  }

  function handleReferenceChange(id: string | null) {
    const ref = references.find((r) => r.id === id) || null;

    setInputs((prev) => ({
      ...prev,
      selectedReferenceId: id,
      referenceScheme: ref?.scheme ?? null,
      referencePercent: ref?.default_percent ?? 0,
      referenceFixed: ref?.default_fixed ?? 0,
    }));
  }

  function addAccessoryRow() {
    const newRow: AccessoryRow = {
      id: `acc-${accessoryIdCounter++}`,
      name: "",
      unitCost: 0,
      quantity: 1,
    };
    setInputs((prev) => ({
      ...prev,
      accessories: [...prev.accessories, newRow],
    }));
  }

  function updateAccessoryRow(id: string, patch: Partial<AccessoryRow>) {
    setInputs((prev) => ({
      ...prev,
      accessories: prev.accessories.map((row) =>
        row.id === id ? { ...row, ...patch } : row
      ),
    }));
  }

  function removeAccessoryRow(id: string) {
    setInputs((prev) => ({
      ...prev,
      accessories: prev.accessories.filter((row) => row.id !== id),
    }));
  }

  if (loading) {
    return <div className="p-4">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Karlılık Hesaplama Aracı</h1>

      {/* Device + date */}
      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">1. Cihaz ve Tarih</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Cihaz modeli
            </label>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={inputs.selectedModel}
              onChange={(e) => handleDeviceModelChange(e.target.value)}
            >
              <option value="">Seçiniz</option>
              {deviceModels.map((m) => (
                <option key={m.model} value={m.model}>
                  {m.brand ? `${m.brand} - ${m.model}` : m.model}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Tarih (geçerli maliyet için)
            </label>
            <input
              type="date"
              className="w-full border rounded px-2 py-1 text-sm"
              value={inputs.asOfDate}
              onChange={(e) => handleChange("asOfDate", e.target.value)}
            />
          </div>
        </div>

        <div className="text-sm mt-2 space-y-1">
          {deviceCostLoading ? (
            <div>Cihaz maliyeti yükleniyor...</div>
          ) : deviceCost == null ? (
            <div className="text-red-600">
              Seçilen tarih için cihaz maliyeti bulunamadı.
            </div>
          ) : (
            <div>
              Cihaz maliyeti (C):{" "}
              <span className="font-semibold">
                {deviceCost.toLocaleString("tr-TR", {
                  maximumFractionDigits: 2,
                })}{" "}
                TL
              </span>
            </div>
          )}

          {selectedDeviceMeta?.listPrice != null && (
            <div className="text-xs text-gray-700">
              Liste fiyatı (bilgi amaçlı):{" "}
              <span className="font-semibold">
                {selectedDeviceMeta.listPrice.toLocaleString("tr-TR", {
                  maximumFractionDigits: 2,
                })}{" "}
                TL
              </span>
              {" "}— Satış fiyatını gir modunda, fiyat boşsa bu değer başlangıç
              olarak kullanılır.
            </div>
          )}
        </div>
      </section>

      {/* Reference + tax */}
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
                handleReferenceChange(
                  e.target.value ? e.target.value : null
                )
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
                handleChange(
                  "referenceScheme",
                  (e.target.value || null) as any
                )
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
                  handleChange(
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
                  handleChange("referenceFixed", Number(e.target.value || 0))
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
                handleChange("taxRate", Number(e.target.value || 0) / 100)
              }
            />
            <p className="text-xs text-gray-600 mt-1">
              KDV hesaplanmaz (işitme cihazı KDV’den muaftır). Vergi sadece
              gelir vergisi olarak düşünülür.
            </p>
          </div>
        </div>
      </section>

      {/* Accessories */}
      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">3. Aksesuar Maliyeti</h2>
        <p className="text-sm text-gray-700">
          Müşteri toplam fiyatı soruyor, aksesuarlar ayrıca fiyatlanmıyor.
          Burada sadece bu satışa ait aksesuar{" "}
          <span className="font-semibold">maliyetlerini</span> ekle.
        </p>

        <div className="space-y-2">
          {inputs.accessories.map((acc) => (
            <div
              key={acc.id}
              className="grid grid-cols-12 gap-2 items-center"
            >
              <input
                className="col-span-4 border rounded px-2 py-1 text-sm"
                placeholder="Ad (isteğe bağlı)"
                value={acc.name}
                onChange={(e) =>
                  updateAccessoryRow(acc.id, { name: e.target.value })
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
                  updateAccessoryRow(acc.id, {
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
                  updateAccessoryRow(acc.id, {
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
                onClick={() => removeAccessoryRow(acc.id)}
              >
                Sil
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="text-sm px-3 py-1 border rounded"
          onClick={addAccessoryRow}
        >
          + Aksesuar satırı ekle
        </button>

        <div className="text-sm mt-2">
          Toplam aksesuar maliyeti:{" "}
          <span className="font-semibold">
            {calcAccessoriesCost(inputs.accessories).toLocaleString("tr-TR", {
              maximumFractionDigits: 2,
            })}{" "}
            TL
          </span>
        </div>
      </section>

      {/* Mode + inputs */}
      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">4. Hesaplama Modu</h2>

        <div className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            className={
              "px-3 py-1 border rounded " +
              (inputs.mode === "price"
                ? "bg-gray-900 text-white"
                : "bg-white")
            }
            onClick={() => handleChange("mode", "price")}
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
            onClick={() => handleChange("mode", "targetOnCost")}
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
            onClick={() => handleChange("mode", "targetOnRevenue")}
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
                  handleChange(
                    "salePrice",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              />
              {selectedDeviceMeta?.listPrice != null && (
                <p className="text-xs text-gray-600 mt-1">
                  Liste fiyatı:{" "}
                  {selectedDeviceMeta.listPrice.toLocaleString("tr-TR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  TL. İstersen buradan yukarıya kopyalayıp üzerinden pazarlık
                  yapabilirsin.
                </p>
              )}
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
                  handleChange(
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
                  handleChange(
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

      {/* Result */}
      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">5. Sonuç</h2>

        {!deviceCost && (
          <p className="text-sm text-red-600">
            Hesaplama için önce cihaz modeli ve geçerli bir tarih seçmelisin.
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
            </div>
          </>
        )}
      </section>
    </div>
  );
};
