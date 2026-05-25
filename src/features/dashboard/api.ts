// src/features/dashboard/api.ts
// Dashboard API + React Query hook wired to Supabase dashboard_kpis RPC.

import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type {
  DashboardKpis,
  DashboardResponse,
  LowSatisfactionMeetingItem,
  StockWarningItem,
  UpcomingMeetingItem,
} from './types';
import { DASHBOARD_QUERY_KEY } from './api.keys';

type UpcomingMeetingRpcRow = {
  id: string;
  meeting_type: string | null;
  subject: string | null;
  subject_name: string | null;
  at: string | null;
  next_at: string | null;
  follow_up_at: string | null;
  alert_severity: string | null;
};

type StockWarningRpcRow = {
  catalog_model_id: string;
  brand: string | null;
  model: string | null;
  item_type: string | null;
  in_stock_count: unknown;
  minimum_stock: unknown;
  threshold_scope: string | null;
  severity: string | null;
};

export type CreateDashboardFollowUpMeetingInput = {
  sourceMeetingId: string;
  subject: string;
  note: string | null;
  at: string;
  nextAt: string | null;
  satisfaction10?: number | null;
};

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Safely read a numeric field from an RPC row.
 * Handles both camelCase (revenueTotal) and lowercase (revenuetotal)
 * to be robust against PostgREST/SQL casing differences.
 */
function readNumberField(
  row: Record<string, unknown> | null,
  camelName: string,
): number {
  if (!row) return 0;
  const lowerName = camelName.toLowerCase();
  const value =
    // Prefer exact camelCase key if it exists
    Object.prototype.hasOwnProperty.call(row, camelName)
      ? row[camelName]
      : row[lowerName];
  return toNumber(value);
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

  const firstRow = (Array.isArray(data) ? data[0] : null) as
    | Record<string, unknown>
    | null;

  if (!firstRow) {
    throw new Error('DASHBOARD_KPIS_RPC_FAILED: RPC returned empty result');
  }

  return {
    revenueTotal: readNumberField(firstRow, 'revenueTotal'),
    sgkEnteredThisMonthTotal: readNumberField(
      firstRow,
      'sgkEnteredThisMonthTotal',
    ),
    deviceSgkEnteredThisMonthTotal: readNumberField(
      firstRow,
      'deviceSgkEnteredThisMonthTotal',
    ),
    batterySgkEnteredThisMonthTotal: readNumberField(
      firstRow,
      'batterySgkEnteredThisMonthTotal',
    ),
    sgkDueThisMonthTotal: readNumberField(firstRow, 'sgkDueThisMonthTotal'),
    deviceSgkDueThisMonthTotal: readNumberField(
      firstRow,
      'deviceSgkDueThisMonthTotal',
    ),
    batterySgkDueThisMonthTotal: readNumberField(
      firstRow,
      'batterySgkDueThisMonthTotal',
    ),
    devicesSoldCount: readNumberField(firstRow, 'devicesSoldCount'),
    devicePatientsCount: readNumberField(firstRow, 'devicePatientsCount'),
    cardFeeTotal: readNumberField(firstRow, 'cardFeeTotal'),
    referenceCommissionTotal: readNumberField(
      firstRow,
      'referenceCommissionTotal',
    ),
    unpaidInstallmentsDueThisMonth: readNumberField(
      firstRow,
      'unpaidInstallmentsDueThisMonth',
    ),
    criticalStockModelCount: readNumberField(
      firstRow,
      'criticalStockModelCount',
    ),
    lowStockModelCount: readNumberField(firstRow, 'lowStockModelCount'),
    importErrorJobCount: readNumberField(firstRow, 'importErrorJobCount'),
    inventoryImportErrorRowCount: readNumberField(
      firstRow,
      'inventoryImportErrorRowCount',
    ),
  };
}

export async function createDashboardFollowUpMeeting(
  input: CreateDashboardFollowUpMeetingInput,
): Promise<string> {
  const { data, error } = await supabaseClient.rpc(
    'create_dashboard_follow_up_meeting',
    {
      p_source_meeting_id: input.sourceMeetingId,
      p_subject: input.subject,
      p_note: input.note,
      p_at: input.at,
      p_next_at: input.nextAt,
      p_satisfaction_10: input.satisfaction10 ?? null,
    },
  );

  if (error) {
    console.error('DASHBOARD_FOLLOW_UP_CREATE_FAILED', error.message);
    throw new Error(
      `DASHBOARD_FOLLOW_UP_CREATE_FAILED: ${
        error.message ?? 'Unknown error'
      }`,
    );
  }

  if (!data) {
    throw new Error('DASHBOARD_FOLLOW_UP_CREATE_FAILED: RPC returned empty id');
  }

  return String(data);
}

/**
 * Fetch full dashboard payload. KPIs via RPC; upcoming meetings via dedicated RPC.
 */
export async function fetchDashboardData(
  monthStartIso: string,
): Promise<DashboardResponse> {
  const kpis = await fetchDashboardKpis(monthStartIso);
  const upcomingMeetings = await fetchUpcomingMeetings();
  const stockWarnings = await fetchStockWarnings();
  const lowSatisfactionMeetings = await fetchLowSatisfactionMeetings();

  return {
    kpis,
    // TODO (Phase 5): populate tasks when task generation backend is implemented.
    tasks: [],
    upcomingMeetings,
    stockWarnings,
    lowSatisfactionMeetings,
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

  return (data as UpcomingMeetingRpcRow[]).map((row) => {
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
      followUpAt: (row.follow_up_at as string | null) ?? null,
      alertSeverity: row.alert_severity === 'error' ? 'error' : 'warning',
    };
  });
}

async function fetchStockWarnings(limit = 10): Promise<StockWarningItem[]> {
  const { data, error } = await supabaseClient.rpc('dashboard_stock_warnings', {
    _limit: limit,
  });

  if (error) {
    console.error('DASHBOARD_STOCK_WARNINGS_RPC_FAILED', error.message);
    throw new Error(
      `DASHBOARD_STOCK_WARNINGS_RPC_FAILED: ${
        error.message ?? 'Unknown error'
      }`,
    );
  }

  return ((data ?? []) as StockWarningRpcRow[]).map((row) => ({
    catalogModelId: row.catalog_model_id,
    brand: row.brand ?? '',
    model: row.model ?? '',
    itemType: row.item_type ?? '',
    inStockCount: toNumber(row.in_stock_count),
    minimumStock: toNumber(row.minimum_stock),
    thresholdScope: row.threshold_scope === 'model' ? 'model' : 'general',
    severity: row.severity === 'error' ? 'error' : 'warning',
  }));
}

async function fetchLowSatisfactionMeetings(
  limit = 10,
): Promise<LowSatisfactionMeetingItem[]> {
  const { data, error } = await supabaseClient
    .from('meetings')
    .select('id, subject_name, subject, at, satisfaction_10')
    .eq('meeting_type', 'patient')
    .is('deleted_at', null)
    .not('satisfaction_10', 'is', null)
    .lte('satisfaction_10', 6)
    .order('at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('DASHBOARD_LOW_SATISFACTION_FETCH_FAILED', error.message);
    return [];
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    subjectName: (row.subject_name as string | null) ?? null,
    subject: (row.subject as string | null) ?? null,
    at: (row.at as string | null) ?? null,
    satisfaction10: toNumber(row.satisfaction_10),
  }));
}
