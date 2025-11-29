// src/features/profitCalculator/hooks/useProfitCalculatorForm.ts
// Summary: Encapsulates state, side-effects, and handlers for ProfitCalculatorForm.

import { useEffect, useMemo, useState } from "react";
import {
  AccessoryRow,
  DeviceModelOption,
  ProfitCalcInputs,
  ProfitCalcResult,
  ReferenceOption,
} from "../types";
import {
  fetchChargerOptions,
  fetchDeviceModelOptions,
  fetchEffectiveDeviceCost,
  fetchReferenceOptions,
} from "../api";
import {
  createEmptyInputs,
  calcAccessoriesCost,
  calculateResult,
} from "../logic";

let accessoryIdCounter = 1;

export function useProfitCalculatorForm() {
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

  // init
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

  // load cost when model/date changes
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
      if (!inputs.selectedBrand) return true;
      const b = (m.brand ?? "").trim();
      return b === inputs.selectedBrand;
    });
  }, [deviceModels, inputs.selectedBrand]);

  const result: ProfitCalcResult | null = useMemo(
    () => calculateResult(inputs, deviceUnitCost, deviceListPrice),
    [inputs, deviceUnitCost, deviceListPrice]
  );

  const totalDeviceCost =
    deviceUnitCost != null
      ? deviceUnitCost * Math.max(1, inputs.deviceQuantity || 1)
      : null;

  const accessoriesTotal = useMemo(
    () => calcAccessoriesCost(inputs.accessories),
    [inputs.accessories]
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

  function handleBrandChange(brand: string) {
    setInputs((prev) => {
      const stillValid = filteredModels.some(
        (m) => m.model === prev.selectedModel
      );
      const next: ProfitCalcInputs = {
        ...prev,
        selectedBrand: brand,
      };
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

  return {
    // raw data
    loading,
    deviceModels,
    chargerModels,
    references,

    // state
    inputs,
    deviceUnitCost,
    deviceListPrice,
    deviceCostLoading,
    showDate,
    setShowDate,
    selectedChargerModel,
    setSelectedChargerModel,

    // derived
    brandOptions,
    filteredModels,
    result,
    totalDeviceCost,
    accessoriesTotal,

    // handlers
    handleChange,
    handleBrandChange,
    handleReferenceChange,
    addAccessoryRow,
    addChargerFromSelection,
    updateAccessoryRow,
    removeAccessoryRow,
  };
}
