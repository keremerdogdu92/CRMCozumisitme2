// src/features/reports/types.ts
// Summary: Types for CRM reporting dashboard (financial + inventory + SGK).

export type ReportsMonthFilter = {
  /** Selected month, ISO 'YYYY-MM' – e.g. '2025-12' */
  month: string;
};

export type FirmTotals = {
  /** Siventos firmasına çekilen toplam tutar (seçili ay için) */
  siventosTotal: number;
  /** Time firmasına çekilen toplam tutar (seçili ay için) */
  timeTotal: number;
  /** Tüm firmalara çekilen toplam tutar (seçili ay için) */
  combinedTotal: number;
};

export type MonthlyRevenuePoint = {
  /** Month key like '2025-01' */
  monthKey: string;
  /** Short label for UI like '01/25' */
  label: string;
  /** Total revenue for that month (ciro) */
  total: number;
};

export type PieSlice = {
  /** Label: brand + model combined */
  label: string;
  /** Count of sold devices in selected month */
  value: number;
};

export type ReportsKpis = {
  /** Toplam açık bakiye / alacaklar (tüm hastalar) */
  totalReceivables: number;

  /** Seçili ay için toplam vergi tutarı (KDV vs) */
  monthlyTaxAmount: number;

  /** Son 12 ay için toplam vergi tutarı */
  yearlyTaxAmount: number;

  /** Firmalara çekilen tutarlar (Siventos / Time / toplam) */
  firmTotals: FirmTotals;

  /** Stoktaki toplam cihaz adedi (aktif, silinmemiş) */
  totalStockQuantity: number;

  /** Stoktaki cihazların toplam maliyeti (cost_price toplamı) */
  totalStockCost: number;

  /** Seçili ayda satılan cihaz adedi */
  monthDevicesSoldCount: number;

  /** Seçili ayda satılan cihazların toplam maliyeti */
  monthDevicesSoldCost: number;

  /** Seçili ay için ciro (cihaz + aksesuar + pil dahil) */
  monthlyTurnover: number;

  /** Bu ay SGK’dan yatması beklenen tutar (3 ay önce işlenenler) */
  sgkDueThisMonth: number;

  /** Önümüzdeki 3 ay içinde SGK’dan yatması beklenen toplam tutar */
  sgkDueNextThreeMonths: number;

  /** 12 aylık ciro grafiği (bar chart) */
  revenueByMonth: MonthlyRevenuePoint[];

  /** Seçili ayda satılan cihazların marka-model dağılımı (pie chart) */
  devicesPie: PieSlice[];
};
