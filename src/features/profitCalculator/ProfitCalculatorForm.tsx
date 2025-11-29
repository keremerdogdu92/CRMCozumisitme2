// src/features/profitCalculator/ProfitCalculatorForm.tsx
// Summary: React UI composition for the Profitability Calculator.
// Uses current_device_model_prices_public for device & charger prices.
// State, side-effects, and calculation logic are delegated to useProfitCalculatorForm + ./logic.

import React from "react";
import { useProfitCalculatorForm } from "./hooks/useProfitCalculatorForm";
import { DeviceSection } from "./components/DeviceSection";
import { ReferenceTaxSection } from "./components/ReferenceTaxSection";
import { AccessoriesSection } from "./components/AccessoriesSection";
import { ModeSection } from "./components/ModeSection";
import { ResultSection } from "./components/ResultSection";

export const ProfitCalculatorForm: React.FC = () => {
  const {
    // state & derived
    loading,
    inputs,
    deviceUnitCost,
    deviceCostLoading,
    showDate,
    setShowDate,
    brandOptions,
    filteredModels,
    references,
    chargerModels,
    selectedChargerModel,
    setSelectedChargerModel,
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
  } = useProfitCalculatorForm();

  if (loading) {
    return <div className="p-4">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Karlılık Hesaplama Aracı</h1>

      <DeviceSection
        inputs={inputs}
        brandOptions={brandOptions}
        filteredModels={filteredModels}
        deviceUnitCost={deviceUnitCost}
        deviceCostLoading={deviceCostLoading}
        totalDeviceCost={totalDeviceCost}
        showDate={showDate}
        onToggleDate={() => setShowDate((v) => !v)}
        onChange={handleChange}
        onBrandChange={handleBrandChange}
      />

      <ReferenceTaxSection
        inputs={inputs}
        references={references}
        onChange={handleChange}
        onReferenceChange={handleReferenceChange}
      />

      <AccessoriesSection
        accessories={inputs.accessories}
        chargerModels={chargerModels}
        selectedChargerModel={selectedChargerModel}
        accessoriesTotal={accessoriesTotal}
        onSelectedChargerModelChange={setSelectedChargerModel}
        onAddChargerFromSelection={addChargerFromSelection}
        onAddAccessoryRow={addAccessoryRow}
        onUpdateAccessoryRow={updateAccessoryRow}
        onRemoveAccessoryRow={removeAccessoryRow}
      />

      <ModeSection inputs={inputs} onChange={handleChange} />

      <ResultSection result={result} totalDeviceCost={totalDeviceCost} />
    </div>
  );
};
