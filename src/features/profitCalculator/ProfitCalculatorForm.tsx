// src/features/profitCalculator/ProfitCalculatorForm.tsx
// Summary: React UI for the Profitability Calculator.
// Uses current_device_model_prices_public for device & charger prices.
// Calculation logic is delegated to ./logic for testability and reuse.

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
  fetchChargerOptions,
  fetchDeviceModelOptions,
  fetchEffectiveDeviceCost,
  fetchReferenceOptions,
} from "./api";
import {
  createEmptyInputs,
  calcAccessoriesCost,
  calculateResult,
} from "./logic";

let accessoryIdCounter = 1;

export const ProfitCalculatorForm: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [deviceModels, setDeviceModels] = useState<DeviceModelOption[]>([]);
  const [chargerModels, setChargerModels] = useState<DeviceModelOption[]>([]);
  const [references, setReferences] = useState<ReferenceOption[]>([]);
  const [inputs, setInputs] = useState<ProfitCalcInputs>(createEmptyInputs());
  const [deviceUnitCost, setDeviceUnitCost] = useState<number | null>(null);
  const [deviceListPrice, setDeviceListPrice] = useState<number | null>(null);
  const [deviceCostLoading, setDeviceCostLoading] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [selectedChargerModel, setSelectedChargerModel] = useState<string>("");

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [models, refs, chargers] = await Promise.all([
          fetchDeviceModelOptions(),
          fetchReferenceOptions(),
          fetchChargerOptions(),
        ]);

        setDeviceModels(models);
        setReferences(refs);
        setChargerModels(chargers);

        // Default brand: REXTON, if exists
        const brands = Array.from(
          new Set(
            models
              .map((m) => (m.brand ?? "").trim())
              .filter((b) => b.length > 0)
          )
        );
        const hasRexton = brands.includes("REXTON");
        setInputs((prev) => ({
          ...prev,
          selectedBrand: hasRexton ? "REXTON" : "",
        }));
      } catch (err) {
        console.error("ProfitCalculator init error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    async function loadCost() {
      if (!inputs.selectedModel) {
        setDeviceUnitCost(null);
        setDeviceListPrice(null);
        return;
      }
      setDeviceCostLoading(true);
      try {
        const info = await fetchEffectiveDeviceCost(
          inputs.selectedModel,
          inputs.asOfDate
        );
        setDeviceUnitCost(info.deviceCost);
        setDeviceListPrice(info.listPrice);
      } catch (err) {
        console.error("loadCost error:", err);
        setDeviceUnitCost(null);
        setDeviceListPrice(null);
      } finally {
        setDeviceCostLoading(false);
      }
    }
    loadCost();
  }, [inputs.selectedModel, inputs.asOfDate]);

  const brandOptions = useMemo(() => {
    const brands = new Set<string>();
    for (const m of deviceModels) {
      const b = (m.brand ?? "").trim();
      if (b) brands.add(b);
    }
    return Array.from(brands).sort();
  }, [deviceModels]);

  const filteredModels = useMemo(() => {
    return deviceModels.filter((m) => {
      if (!inputs.selectedBrand) return true; // Tümü
      const b = (m.brand ?? "").trim();
      return b === inputs.selectedBrand;
    });
  }, [deviceModels, inputs.selectedBrand]);

  const result = useMemo(
    () => calculateResult(inputs, deviceUnitCost, deviceListPrice),
    [inputs, deviceUnitCost, deviceListPrice]
  );

  const totalDeviceCost =
    deviceUnitCost != null
      ? deviceUnitCost * Math.max(1, inputs.deviceQuantity || 1)
      : null;

  function handleChange<K extends keyof ProfitCalcInputs>(
    key: K,
    value: ProfitCalcInputs[K]
  ) {
    setInputs((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleBrandChange(brand: string) {
    setInputs((prev) => {
      const next: ProfitCalcInputs = {
        ...prev,
        selectedBrand: brand,
      };

      // Eğer seçili model yeni brand filtresine uymuyorsa temizle
      const stillValid = filteredModels.some(
        (m) => m.model === prev.selectedModel
      );
      if (!stillValid) {
        next.selectedModel = "";
      }

      return next;
    });
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

  function addAccessoryRow(preset?: { name: string; unitCost: number }) {
    const newRow: AccessoryRow = {
      id: `acc-${accessoryIdCounter++}`,
      name: preset?.name ?? "",
      unitCost: preset?.unitCost ?? 0,
      quantity: 1,
    };
    setInputs((prev) => ({
      ...prev,
      accessories: [...prev.accessories, newRow],
    }));
  }

  function addChargerFromSelection() {
    if (!selectedChargerModel) return;
    const charger = chargerModels.find(
      (c) => c.model === selectedChargerModel
    );
    if (!charger) return;

    addAccessoryRow({
      name: charger.model,
      unitCost: charger.purchasePrice ?? 0,
    });

    setSelectedChargerModel("");
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
        <h2 className="font-semibold">1. Cihaz</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">
              Marka
            </label>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={inputs.selectedBrand}
              onChange={(e) => handleBrandChange(e.target.value)}
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
              onChange={(e) => handleChange("selectedModel", e.target.value)}
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
                handleChange(
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
          onClick={() => setShowDate((v) => !v)}
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
              onChange={(e) => handleChange("asOfDate", e.target.value)}
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
              tercihen <span className="font-semibold">list_price</span>{" "}
              ekli mi?).
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

        {/* Charger quick-add from price list */}
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-9 md:col-span-10">
            <label className="block text-sm font-medium mb-1">
              Şarj aleti hızlı ekleme (listeye kayıtlı olanlar)
            </label>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={selectedChargerModel}
              onChange={(e) => setSelectedChargerModel(e.target.value)}
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
              onClick={addChargerFromSelection}
              disabled={!selectedChargerModel}
            >
              + Ekle
            </button>
          </div>
        </div>

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
          onClick={() => addAccessoryRow()}
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
                          (
                          {result.discountPercent.toFixed(1)}
                          {" %"}
                          )
                        </span>
                      </div>
                    )}
                </>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
