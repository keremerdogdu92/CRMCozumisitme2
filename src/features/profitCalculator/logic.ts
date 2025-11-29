// src/features/profitCalculator/logic.ts
// Summary: Pure calculation utilities for the Profitability Calculator.
// Contains only side-effect-free helpers that can be unit-tested and reused.

import type {
  AccessoryRow,
  ProfitCalcInputs,
  ProfitCalcResult,
} from "./types";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyInputs(): ProfitCalcInputs {
  return {
    mode: "price",

    selectedBrand: "REXTON",
    selectedModel: "",
    asOfDate: todayISO(),

    deviceQuantity: 2, // çoğu durumda sağ + sol

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

export function calcAccessoriesCost(accessories: AccessoryRow[]): number {
  return accessories.reduce(
    (sum, acc) => sum + acc.unitCost * acc.quantity,
    0
  );
}

export function calculateResult(
  inputs: ProfitCalcInputs,
  unitDeviceCost: number | null,
  unitListPrice: number | null
): ProfitCalcResult | null {
  if (unitDeviceCost == null || unitDeviceCost < 0) {
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
    deviceQuantity,
  } = inputs;

  const qty = Math.max(1, deviceQuantity || 1);

  const C_unit = unitDeviceCost;
  const C = C_unit * qty; // toplam cihaz maliyeti
  const listTotal =
    unitListPrice != null ? unitListPrice * qty : null;

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
    const K_target = targetOnCostPercent * C_eff;

    if (referenceScheme === "percent") {
      const r = referencePercent;
      const denom = 1 - r - t;
      if (denom <= 0) {
        error =
          "Seçilen hedef + referans + vergi oranı matematiksel olarak imkânsız (1 - r - t ≤ 0).";
      } else {
        S = (K_target + C_eff * (1 - t)) / denom;
      }
    } else {
      const R_fixed = referenceScheme === "fixed" ? referenceFixed : 0;
      const denom = 1 - t;
      if (denom <= 0) {
        error = "Vergi oranı 100% veya üzeri. Geçerli değil.";
      } else {
        S = (K_target + C_eff * (1 - t) + R_fixed) / denom;
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
      listPriceTotal: listTotal,
      discountAmount: null,
      discountPercent: null,
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

  let discountAmount: number | null = null;
  let discountPercent: number | null = null;

  if (listTotal != null) {
    discountAmount = listTotal - S;
    discountPercent =
      listTotal > 0 ? (discountAmount / listTotal) : null;
  }

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
    listPriceTotal: listTotal,
    discountAmount,
    discountPercent,
  };
}
