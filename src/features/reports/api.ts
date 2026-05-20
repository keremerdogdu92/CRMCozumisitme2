// src/features/reports/api.ts
// Summary: React Query hook that fetches reporting KPIs from Supabase RPC.

import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type { ReportsKpis, ReportsMonthFilter } from './types';
import { REPORTS_QUERY_KEYS } from './api.keys';

type QueryKey = [typeof REPORTS_QUERY_KEYS.kpis, ReportsMonthFilter];

async function fetchReportsKpis(filter: ReportsMonthFilter): Promise<ReportsKpis> {
  const { month } = filter;

  // Convert 'YYYY-MM' -> 'YYYY-MM-01' for Postgres date
  const monthDate = `${month}-01`;

  const { data, error } = await supabaseClient.rpc('reports_kpis_v1', {
    p_month: monthDate,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[Reports] fetchReportsKpis error', error);
    throw error;
  }

  // reports_kpis_v1 returns table(...), so Supabase wraps it as:
  // [{ totalReceivables: ..., revenueByMonth: [...], ... }]
  // Take the first row directly.
  const payload = Array.isArray(data) && data.length > 0 ? data[0] : data;

  // eslint-disable-next-line no-console
  console.log('[Reports] raw payload', payload);

  // Supabase may return jsonb columns as JSON strings — parse defensively.
  const parseJsonbArray = (val: unknown): unknown[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val) as unknown[]; } catch { return []; }
    }
    return [];
  };

  const base = (payload as ReportsKpis | null) ?? {
    totalReceivables: 0,
    monthlyTaxAmount: 0,
    yearlyTaxAmount: 0,
    firmTotals: { siventosTotal: 0, timeTotal: 0, combinedTotal: 0 },
    totalStockQuantity: 0,
    totalStockCost: 0,
    monthDevicesSoldCount: 0,
    monthDevicesSoldCost: 0,
    monthlyTurnover: 0,
    sgkDueThisMonth: 0,
    sgkEstimatedThisMonth: 0,
    sgkRecordedThisMonth: 0,
    sgkDueNextThreeMonths: 0,
    sgkPaymentRows: [],
    revenueByMonth: [],
    devicesPie: [],
  };

  // Ensure jsonb array fields are always real JS arrays (not strings).
  const raw: ReportsKpis = {
    ...base,
    sgkEstimatedThisMonth:
      Number(base.sgkEstimatedThisMonth ?? base.sgkDueThisMonth ?? 0) || 0,
    sgkRecordedThisMonth: Number(base.sgkRecordedThisMonth ?? 0) || 0,
    revenueByMonth: parseJsonbArray(base.revenueByMonth) as ReportsKpis['revenueByMonth'],
    devicesPie: parseJsonbArray(base.devicesPie) as ReportsKpis['devicesPie'],
    sgkPaymentRows: parseJsonbArray(base.sgkPaymentRows) as ReportsKpis['sgkPaymentRows'],
  };

  return raw;
}

export function useReportsKpis(filter: ReportsMonthFilter) {
  return useQuery<ReportsKpis, unknown, ReportsKpis, QueryKey>({
    queryKey: [REPORTS_QUERY_KEYS.kpis, filter],
    queryFn: () => fetchReportsKpis(filter),
    staleTime: 1000 * 60 * 5,
  });
}
