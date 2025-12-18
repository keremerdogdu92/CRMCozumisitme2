// src/features/reports/ReportsDashboard.tsx
// Summary: Reporting dashboard view with KPI cards, monthly revenue bar chart
// and device brand/model pie chart.

import { useMemo, useState } from 'react';
import type { ReportsMonthFilter, ReportsKpis, MonthlyRevenuePoint, PieSlice } from './types';
import { useReportsKpis } from './api';

function getDefaultMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const mm = month < 10 ? `0${month}` : String(month);
  return `${year}-${mm}`; // YYYY-MM
}

export function ReportsDashboard() {
  const [filter, setFilter] = useState<ReportsMonthFilter>({ month: getDefaultMonth() });

  const { data, isLoading, isError } = useReportsKpis(filter, {
    keepPreviousData: true,
  });

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
          Seçili ay: <span className="font-semibold text-slate-700">{monthLabel}</span>
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

            <KpiCard
              title="Aylık ciro"
              value={kpis.monthlyTurnover}
              suffix="₺"
            />

            <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium text-slate-500">
                SGK beklenen ödemeler
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Bu ay ve gelecek 3 ay toplamı
              </div>
              <div className="mt-3 flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Bu ay yatması beklenen</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(kpis.sgkDueThisMonth)} ₺
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Önümüzdeki 3 ay toplam</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(kpis.sgkDueNextThreeMonths)} ₺
                  </span>
                </div>
              </div>
            </div>
          </div>

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
        {suffix ? <span className="ml-1 text-sm font-normal text-slate-500">{suffix}</span> : null}
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
