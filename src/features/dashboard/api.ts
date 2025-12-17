// src/features/dashboard/api.ts
// Dashboard API + React Query hook wired to Supabase dashboard_kpis RPC.

import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type {
  DashboardKpis,
  DashboardResponse,
  UpcomingMeetingItem,
} from './types';
import { DASHBOARD_QUERY_KEY } from './api.keys';

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Fetch KPI aggregates for the given month window.
 * Uses Europe/Istanbul month window on the RPC side.
 */
export async function fetchDashboardKpis(
  monthStartIso: string,
): Promise<DashboardKpis> {
  const { data, error } = await supabaseClient.rpc('dashboard_kpis', {
    _month_start: monthStartIso,
  });

  if (error) {
    console.error('DASHBOARD_KPIS_RPC_FAILED', error.message);
    throw new Error(
      `DASHBOARD_KPIS_RPC_FAILED: ${error.message ?? 'Unknown error'}`,
    );
  }

  const firstRow = Array.isArray(data) ? data[0] : null;
  if (!firstRow) {
    throw new Error('DASHBOARD_KPIS_RPC_FAILED: RPC returned empty result');
  }

  return {
    revenueTotal: toNumber(firstRow.revenueTotal),
    sgkEnteredThisMonthTotal: toNumber(firstRow.sgkEnteredThisMonthTotal),
    sgkDueThisMonthTotal: toNumber(firstRow.sgkDueThisMonthTotal),
    devicesSoldCount: toNumber(firstRow.devicesSoldCount),
    devicePatientsCount: toNumber(firstRow.devicePatientsCount),
    cardFeeTotal: toNumber(firstRow.cardFeeTotal),
    referenceCommissionTotal: toNumber(firstRow.referenceCommissionTotal),
    unpaidInstallmentsDueThisMonth: toNumber(
      firstRow.unpaidInstallmentsDueThisMonth,
    ),
  };
}

/**
 * Fetch full dashboard payload. KPIs via RPC; upcoming meetings via dedicated RPC.
 */
export async function fetchDashboardData(
  monthStartIso: string,
): Promise<DashboardResponse> {
  const kpis = await fetchDashboardKpis(monthStartIso);
  const upcomingMeetings = await fetchUpcomingMeetings();

  return {
    kpis,
    // TODO (Phase 5): populate tasks when task generation backend is implemented.
    tasks: [],
    upcomingMeetings,
  };
}

export function useDashboard(monthStartIso: string | null) {
  const enabled = !!monthStartIso;

  return useQuery({
    queryKey: DASHBOARD_QUERY_KEY(monthStartIso),
    queryFn: () => {
      if (!monthStartIso) {
        throw new Error('DASHBOARD_KPIS_RPC_FAILED: monthStartIso is required');
      }
      return fetchDashboardData(monthStartIso);
    },
    enabled,
  });
}

async function fetchUpcomingMeetings(
  limit = 10,
): Promise<UpcomingMeetingItem[]> {
  const { data, error } = await supabaseClient.rpc(
    'dashboard_upcoming_meetings',
    { _limit: limit },
  );

  if (error) {
    console.error('DASHBOARD_UPCOMING_RPC_FAILED', error.message);
    throw new Error(
      `DASHBOARD_UPCOMING_RPC_FAILED: ${error.message ?? 'Unknown error'}`,
    );
  }

  if (!data) {
    return [];
  }

  return (data as any[]).map((row) => {
    const mt = String(row.meeting_type ?? '').toLowerCase();
    const meetingType: UpcomingMeetingItem['meetingType'] =
      mt === 'patient' || mt === 'trial' || mt === 'reference' ? mt : 'other';

    return {
      id: row.id as string,
      meetingType,
      subject: (row.subject as string | null) ?? null,
      subjectName: (row.subject_name as string | null) ?? null,
      at: (row.at as string | null) ?? null,
      nextAt: (row.next_at as string | null) ?? null,
    };
  });
}
