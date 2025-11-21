// src/features/profitCalculator/types.ts
// Summary: Shared types for the Profitability Calculator feature (device prices, references, modes, form state).

export type ProfitCalcMode = "price" | "targetOnCost" | "targetOnRevenue";

export interface DeviceModelOption {
  model: string;
  brand?: string | null;
}

export interface DeviceModelPriceRow {
  id: string;
  model: string;
  brand?: string | null;
  effective_from: string; // ISO date string (YYYY-MM-DD)
  purchase_cost: number;
}

export type ReferenceScheme = "fixed" | "percent" | null;

export interface ReferenceOption {
  id: string;
  name: string;
  scheme: ReferenceScheme;
  // If scheme === 'percent', this is the default percent (ex: 0.10 for %10)
  default_percent?: number | null;
  // If scheme === 'fixed', this is the default fixed amount (TL)
  default_fixed?: number | null;
}

export interface AccessoryRow {
  id: string;
  name: string;
  unitCost: number;
  quantity: number;
}

export interface ProfitCalcInputs {
  mode: ProfitCalcMode;

  // Device + date
  selectedModel: string;
  asOfDate: string; // YYYY-MM-DD

  // Reference
  selectedReferenceId: string | null;
  referenceScheme: ReferenceScheme;
  referencePercent: number; // 0.10 = %10
  referenceFixed: number;   // TL

  // Tax
  taxRate: number; // 0.15 = %15

  // Accessories
  accessories: AccessoryRow[];

  // Sale/targets
  salePrice: number | null;      // S, when mode === 'price'
  targetOnCostPercent: number;   // m_c (ex: 1.0 for %100 of total cost)
  targetOnRevenuePercent: number; // m (ex: 0.20 for %20 of revenue)
}

export interface ProfitCalcResult {
  valid: boolean;
  error?: string;

  salePrice: number; // S
  deviceCost: number; // C
  accessoriesCost: number; // Ac
  totalCost: number; // C_eff = C + Ac

  referenceCommission: number; // R
  taxAmount: number; // T
  netProfit: number; // K

  profitOverCost: number;    // K / C_eff (ratio)
  profitOverRevenue: number; // K / S (ratio)
}
