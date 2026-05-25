// src/features/reports/ReportsDashboard.tsx
// Summary: Reporting dashboard view with KPI cards, monthly revenue bar chart
// and device brand/model pie chart.

import { useMemo, useState } from 'react';
import type {
  ReportsMonthFilter,
  ReportsKpis,
  MonthlyRevenuePoint,
  PieSlice,
} from './types';
import { useReportsKpis } from './api';
import { IncomeTaxCard } from '../finance/IncomeTaxCard';
import { SupplierPayablesCard } from '../finance/SupplierPayablesCard';

function getDefaultMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const mm = month < 10 ? `0${month}` : String(month);
  return `${year}-${mm}`; // YYYY-MM
}

export function ReportsDashboard() {
  const [filter, setFilter] = useState<ReportsMonthFilter>({ month: getDefaultMonth() });

  const { data, isLoading, isError } = useReportsKpis(filter);

  const kpis: ReportsKpis | null = data ?? null;

  function handleMonthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value; // 'YYYY-MM'
    if (!value) return;
    setFilter({ month: value });
  }

  const monthLabel = useMemo(() => {
    if (!filter.month) return '';
    const [year, month] = filter.month.split('-');
    return `${month}.${year}`;
  }, [filter.month]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-col">
          <label className="text-xs font-medium text-slate-600">Ay seç</label>
          <input
            type="month"
            className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
            value={filter.month}
            onChange={handleMonthChange}
          />
        </div>

        <div className="ml-auto text-xs text-slate-500">
          Seçili ay:{' '}
          <span className="font-semibold text-slate-700">{monthLabel}</span>
        </div>
      </div>

      {/* Loading / Error states */}
      {isLoading && (
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Raporlar yükleniyor...
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Rapor verileri yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.
        </div>
      )}

      {!isLoading && kpis && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              title="Toplam alacaklar"
              value={kpis.totalReceivables}
              suffix="₺"
              highlight
            />

            <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-500">
                Toplam vergi tutarı
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Ay / Yıl bazında vergi toplamı
              </div>
              <div className="mt-3 flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Bu ay</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(kpis.monthlyTaxAmount)} ₺
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Son 12 ay</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(kpis.yearlyTaxAmount)} ₺
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-500">
                Firmalara çekilen toplam tutar
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Siventos, Time ve toplam
              </div>
              <div className="mt-3 flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Siventos</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(kpis.firmTotals.siventosTotal)} ₺
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Time</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(kpis.firmTotals.timeTotal)} ₺
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-1">
                  <span className="text-xs font-medium text-slate-600">Toplam</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(kpis.firmTotals.combinedTotal)} ₺
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-500">
                Toplam stok
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Adet ve maliyet
              </div>
              <div className="mt-3 flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Adet</span>
                  <span className="font-semibold text-slate-900">
                    {kpis.totalStockQuantity.toLocaleString('tr-TR')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Maliyet</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(kpis.totalStockCost)} ₺
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-500">
                Ay içinde satılan cihazlar
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Seçili ayda satılan cihaz adedi ve maliyeti
              </div>
              <div className="mt-3 flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Adet</span>
                  <span className="font-semibold text-slate-900">
                    {kpis.monthDevicesSoldCount.toLocaleString('tr-TR')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Maliyet</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(kpis.monthDevicesSoldCost)} ₺
                  </span>
                </div>
              </div>
            </div>

            <KpiCard title="Aylık ciro" value={kpis.monthlyTurnover} suffix="₺" />

            <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-500">
                SGK beklenen ödemeler
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Tahmini ve sisteme işlenen ayrı toplamlar
              </div>
              <div className="mt-3 flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Tahmini SGK</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(kpis.sgkEstimatedThisMonth ?? kpis.sgkDueThisMonth)} ₺
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Sisteme işlenen SGK</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(kpis.sgkRecordedThisMonth ?? 0)} ₺
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Önümüzdeki 3 ay toplam
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(kpis.sgkDueNextThreeMonths)} ₺
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <KpiCard
              title="Cihaz SGK beklenen"
              value={kpis.sgkDeviceDueThisMonth}
              suffix="â‚º"
            />
            <KpiCard
              title="Pil SGK beklenen"
              value={kpis.sgkBatteryDueThisMonth}
              suffix="â‚º"
            />
          </div>

          <IncomeTaxCard
            month={filter.month}
            crmRevenue={kpis.monthlyTurnover}
            inventoryCost={kpis.monthDevicesSoldCost}
          />

          <SupplierPayablesCard />

          <SgkPaymentTrackingTable rows={kpis.sgkPaymentRows ?? []} />

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-500">
                    Aylara göre ciro (son 12 ay)
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Seçili ayı içeren 12 aylık aralık
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <RevenueBarChart points={kpis.revenueByMonth} />
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-500">
                    Marka / model dağılımı
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Seçili ayda satılan cihazlara göre
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-col items-center gap-4 md:flex-row">
                <DevicesPieChart slices={kpis.devicesPie} />
                <DevicesPieLegend slices={kpis.devicesPie} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type SgkPaymentTrackingTableProps = {
  rows: ReportsKpis['sgkPaymentRows'];
};

function SgkPaymentTrackingTable({ rows }: SgkPaymentTrackingTableProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-slate-500">
            SGK hasta takip listesi
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Seçili ayda beklenen SGK ödemeleri hasta bazında
          </div>
        </div>
        <div className="text-[11px] font-medium text-slate-600">
          {rows.length} kayıt
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-500">
          Bu ay için SGK ödeme satırı yok.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2 text-left font-medium text-slate-600">
                  Hasta
                </th>
                <th className="px-2 py-2 text-left font-medium text-slate-600">
                  SGK profili
                </th>
                <th className="px-2 py-2 text-left font-medium text-slate-600">
                  Sisteme işlenme
                </th>
                <th className="px-2 py-2 text-left font-medium text-slate-600">
                  Oran dönemi
                </th>
                <th className="px-2 py-2 text-left font-medium text-slate-600">
                  Beklenen ay
                </th>
                <th className="px-2 py-2 text-right font-medium text-slate-600">
                  Beklenen tutar
                </th>
                <th className="px-2 py-2 text-left font-medium text-slate-600">
                  Fatura
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row) => (
                <tr key={row.row_id ?? row.patient_id}>
                  <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-800">
                    {row.patient_name}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-slate-600">
                    {row.sgk_profile_label || row.sgk_profile || '-'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-slate-600">
                    {formatDateShort(row.sgk_recorded_to_system_at)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-slate-600">
                    {formatDateShort(row.sgk_rate_valid_from)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-slate-600">
                    {formatMonthDate(row.sgk_expected_reimbursement_month)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-slate-900">
                    {formatMoney(row.sgk_expected_reimbursement)} ₺
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-slate-600">
                    {row.invoice_issued
                      ? `Kesildi (${formatDateShort(row.invoice_issued_at)})`
                      : 'Kesilmedi'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type KpiCardProps = {
  title: string;
  value: number;
  suffix?: string;
  highlight?: boolean;
};

function KpiCard({ title, value, suffix, highlight }: KpiCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-md border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">
        <span className={highlight ? 'text-slate-900' : 'text-slate-800'}>
          {formatMoney(value)}
        </span>
        {suffix ? (
          <span className="ml-1 text-sm font-normal text-slate-500">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDateShort(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString('tr-TR');
}

function formatMonthDate(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('tr-TR', {
    month: '2-digit',
    year: 'numeric',
  });
}

type RevenueBarChartProps = {
  points: MonthlyRevenuePoint[];
};

function RevenueBarChart({ points }: RevenueBarChartProps) {
  if (!points.length) {
    return (
      <div className="h-40 p-4 text-center text-xs text-slate-500">
        Grafikte gösterilecek veri bulunamadı.
      </div>
    );
  }

  const max = Math.max(...points.map((p) => p.total), 0) || 1;

  return (
    <div className="flex h-40 items-end gap-2">
      {points.map((p) => {
        const heightPercent = (p.total / max) * 100;
        return (
          <div
            key={p.monthKey}
            className="flex flex-1 flex-col items-center"
          >
            <div
              className="flex w-full items-end rounded-t bg-slate-900"
              style={{ height: `${heightPercent}%` }}
              title={`${p.label}: ${formatMoney(p.total)} ₺`}
            />
            <div className="mt-1 text-[10px] text-slate-500">{p.label}</div>
          </div>
        );
      })}
    </div>
  );
}

type DevicesPieChartProps = {
  slices: PieSlice[];
};

function DevicesPieChart({ slices }: DevicesPieChartProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    return (
      <div className="flex h-32 w-32 items-center justify-center rounded-full bg-slate-50 text-[10px] text-slate-400">
        Veri yok
      </div>
    );
  }

  const colors = ['#4f46e5', '#0ea5e9', '#22c55e', '#f97316', '#e11d48', '#7c3aed'];

  let currentAngle = 0;
  const segments: string[] = [];

  slices.forEach((slice, index) => {
    const ratio = slice.value / total;
    const angle = ratio * 360;
    const start = currentAngle;
    const end = currentAngle + angle;
    const color = colors[index % colors.length];
    segments.push(`${color} ${start}deg ${end}deg`);
    currentAngle = end;
  });

  const backgroundImage = `conic-gradient(${segments.join(', ')})`;

  return (
    <div
      className="h-32 w-32 rounded-full shadow-sm"
      style={{ backgroundImage }}
      aria-label="Cihaz marka/model dağılımı grafiği"
    />
  );
}

type DevicesPieLegendProps = {
  slices: PieSlice[];
};

function DevicesPieLegend({ slices }: DevicesPieLegendProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (!total) {
    return (
      <div className="flex-1 text-xs text-slate-500">
        Bu ay için marka/model dağılımı bulunamadı.
      </div>
    );
  }

  const colors = ['#4f46e5', '#0ea5e9', '#22c55e', '#f97316', '#e11d48', '#7c3aed'];

  return (
    <div className="flex-1 space-y-1 text-xs">
      {slices.map((slice, index) => {
        const ratio = slice.value / total;
        const percentage = Math.round(ratio * 100);

        return (
          <div key={slice.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="truncate text-slate-700">{slice.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">{slice.value}</span>
              <span className="text-[10px] text-slate-400">{percentage}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
