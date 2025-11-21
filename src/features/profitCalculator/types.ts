// src/features/profitCalculator/types.ts
// Summary: Shared types for the Profitability Calculator feature.

export type ProfitCalcMode = 'price' | 'targetOnCost' | 'targetOnRevenue';

export interface DeviceModelOption {
  model: string;
  brand?: string | null;
}

export interface DeviceModelPriceRow {
  id: string;
  model: string;
  brand?: string | null;
  effective_from: string; // date
  purchase_cost: number;
}

export type ReferenceScheme = 'fixed' | 'percent' | null;

export interface ReferenceOption {
  id: string;
  name: string;
  scheme: ReferenceScheme;
  default_percent?: number | null;
  default_fixed?: number | null;
}

// aşağısı UI ve hesap tipleri (önceki mesajdakiyle aynı)
export interface AccessoryRow {
  id: string;
  name: string;
  unitCost: number;
  quantity: number;
}

export interface ProfitCalcInputs {
  mode: ProfitCalcMode;
  selectedModel: string;
  asOfDate: string;
  selectedReferenceId: string | null;
  referenceScheme: ReferenceScheme;
  referencePercent: number;
  referenceFixed: number;
  taxRate: number;
  accessories: AccessoryRow[];
  salePrice: number | null;
  targetOnCostPercent: number;
  targetOnRevenuePercent: number;
}

export interface ProfitCalcResult {
  valid: boolean;
  error?: string;
  salePrice: number;
  deviceCost: number;
  accessoriesCost: number;
  totalCost: number;
  referenceCommission: number;
  taxAmount: number;
  netProfit: number;
  profitOverCost: number;
  profitOverRevenue: number;
}
