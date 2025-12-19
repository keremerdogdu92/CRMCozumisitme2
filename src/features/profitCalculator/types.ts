// src/features/profitCalculator/types.ts
// Summary: Shared types for the Profitability Calculator feature.

export type ProfitCalcMode = 'price' | 'targetOnCost' | 'targetOnRevenue';

export interface DeviceModelOption {
  model: string;
  brand?: string | null;
  itemType?: string | null; // 'hearing_aid' | 'charger' | ...
  listPrice?: number | null;
  purchasePrice?: number | null;
}

export interface DeviceModelPriceRow {
  id: string;
  org_id: string;
  brand: string | null;
  model: string;
  item_type: string | null;
  battery_type: string | null;
  details: string | null;
  notes: string | null;
  valid_from: string | null; // date
  list_price: number | null;
  purchase_price: number | null;
}

export interface DevicePriceInfo {
  deviceCost: number | null; // purchase_price
  listPrice: number | null;  // list_price
}

export type ReferenceScheme = 'fixed' | 'percent' | null;

export interface ReferenceOption {
  id: string;
  name: string;
  scheme: ReferenceScheme;
  /**
   * Default percent commission (0–1). Example: 0.10 = %10
   * Filled from references.commission_percent when available.
   */
  default_percent?: number | null;
  /**
   * Default fixed commission amount in TL.
   * Filled from references.commission_fixed when available.
   */
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
  selectedBrand: string;   // '' = Tümü
  selectedModel: string;
  asOfDate: string; // YYYY-MM-DD (şimdilik sadece UI için)

  deviceQuantity: number; // kaç cihaz (genelde 2: sağ + sol)

  // Reference
  selectedReferenceId: string | null;
  referenceScheme: ReferenceScheme;
  /**
   * Commission rate as 0–1. Example: 0.10 = %10
   */
  referencePercent: number;
  /**
   * Fixed commission amount in TL.
   */
  referenceFixed: number;

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
  deviceCost: number;       // C (toplam cihaz maliyeti, adet dahil)
  accessoriesCost: number;  // Ac
  totalCost: number;        // C_eff = C + Ac

  referenceCommission: number; // R
  taxAmount: number;           // T
  netProfit: number;           // K

  profitOverCost: number;    // K / C_eff
  profitOverRevenue: number; // K / S

  // Optional: list price & discount info
  listPriceTotal?: number | null;   // toplam liste fiyatı (adet dahil)
  discountAmount?: number | null;   // liste - satış
  discountPercent?: number | null;  // (liste - satış) / liste
}
