// src/features/profitCalculator/types.ts
// Summary: Shared types for the Profitability Calculator feature.

export type ProfitCalcMode = 'price' | 'targetOnCost' | 'targetOnRevenue';

export interface DeviceModelOption {
  model: string;
  brand?: string | null;
  // Optional list price from device_model_prices (or its view); used as a default suggestion.
  listPrice?: number | null;
}

export interface DeviceModelPriceRow {
  id: string;
  org_id: string;
  brand: string;
  model: string;
  effective_from: string; // date
  purchase_cost: number;
  list_price: number | null;
}

export type ReferenceScheme = 'fixed' | 'percent' | null;

export interface ReferenceOption {
  id: string;
  name: string;
  scheme: ReferenceScheme;
  // These are not coming from DB yet; reserved for future use:
  default_percent?: number | null;
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
  salePrice: number | null;       // S, when mode === 'price'
  targetOnCostPercent: number;    // m_c (1.0 = %100)
  targetOnRevenuePercent: number; // m (0.20 = %20)
}

export interface ProfitCalcResult {
  valid: boolean;
  error?: string;

  salePrice: number;        // S
  deviceCost: number;       // C
  accessoriesCost: number;  // Ac
  totalCost: number;        // C_eff = C + Ac

  referenceCommission: number; // R
  taxAmount: number;           // T
  netProfit: number;           // K

  profitOverCost: number;    // K / C_eff
  profitOverRevenue: number; // K / S
}
