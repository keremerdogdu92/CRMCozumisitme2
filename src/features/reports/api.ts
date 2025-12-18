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

  const raw = (data as ReportsKpis | null) ?? {
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
    sgkDueNextThreeMonths: 0,
    revenueByMonth: [],
    devicesPie: [],
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
