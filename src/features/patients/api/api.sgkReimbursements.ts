// src/features/patients/api/api.sgkReimbursements.ts
// DB-backed SGK reimbursement periods/rates with static fallback for old installs.

import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../../utils/supabaseClient';
import { SGK_PROFILES, getSgkProfileLabel } from '../sgkProfiles';
import type {
  SgkProfileRate,
  SgkReimbursementPeriod,
} from '../types';

export const SGK_REIMBURSEMENT_PERIODS_QUERY_KEY = [
  'sgk-reimbursement-periods',
] as const;

const FALLBACK_PERIOD_ID = 'fallback-2024-08-13';
const FALLBACK_ORG_ID = 'fallback';
const FALLBACK_VALID_FROM = '2024-08-13';
const FALLBACK_PILL_EXTRA_PER_DEVICE = 624;

type SgkPeriodDbRow = {
  id: string;
  org_id: string;
  valid_from: string;
  pill_extra_per_device: number | string | null;
  created_at: string | null;
  sgk_reimbursement_profile_rates?: SgkRateDbRow[] | null;
};

type SgkRateDbRow = {
  id: string;
  period_id: string;
  profile_id: string;
  label: string;
  gross: number | string;
  net_to_firm: number | string;
  employee_share: number | string | null;
  retiree_share: number | string | null;
  retiree_net_after_share: number | string | null;
};

export type SaveSgkReimbursementPeriodRate = {
  profile_id: string;
  label: string;
  gross: number;
  net_to_firm: number;
  employee_share: number | null;
  retiree_share: number | null;
  retiree_net_after_share: number | null;
};

export type SaveSgkReimbursementPeriodInput = {
  validFrom: string;
  pillExtraPerDevice: number;
  rates: SaveSgkReimbursementPeriodRate[];
};

export type SgkSnapshotCalculation = {
  period: SgkReimbursementPeriod;
  rate: SgkProfileRate | null;
  effectiveDate: string;
  deviceCount: number;
  pillPrescription: boolean;
  baseAmount: number;
  pillExtraAmount: number;
  totalAmount: number;
  totalInput: string;
  expectedMonth: string;
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toSgkDateKey(value: string | null | undefined): string {
  if (!value) return todayDateKey();
  const trimmed = value.trim();
  if (!trimmed) return todayDateKey();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime())
    ? todayDateKey()
    : parsed.toISOString().slice(0, 10);
}

export function formatSgkMoneyInput(value: number): string {
  const rounded = roundMoney(value);
  const fixed = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return fixed.replace('.', ',');
}

export function addThreeMonthsMonthInput(dateKey: string): string {
  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr || '1');
  const base =
    Number.isFinite(year) && Number.isFinite(month)
      ? new Date(Date.UTC(year, month - 1, day))
      : new Date();
  base.setUTCMonth(base.getUTCMonth() + 3);
  const yyyy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function monthInputToIsoDate(monthValue: string): string | null {
  if (!monthValue) return null;
  const [yearStr, monthStr] = monthValue.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, 15)).toISOString();
}

export function createFallbackSgkPeriod(): SgkReimbursementPeriod {
  return {
    id: FALLBACK_PERIOD_ID,
    org_id: FALLBACK_ORG_ID,
    valid_from: FALLBACK_VALID_FROM,
    pill_extra_per_device: FALLBACK_PILL_EXTRA_PER_DEVICE,
    created_at: null,
    rates: SGK_PROFILES.map((profile) => ({
      id: `fallback-${profile.id}`,
      period_id: FALLBACK_PERIOD_ID,
      profile_id: profile.id,
      label: profile.label,
      gross: profile.gross,
      net_to_firm: profile.netToFirm,
      employee_share: profile.employeeShare ?? null,
      retiree_share: profile.retireeShare ?? null,
      retiree_net_after_share: profile.retireeNetAfterShare ?? null,
    })),
  };
}

function mapRate(row: SgkRateDbRow): SgkProfileRate {
  return {
    id: row.id,
    period_id: row.period_id,
    profile_id: row.profile_id,
    label: row.label,
    gross: toNumber(row.gross) ?? 0,
    net_to_firm: toNumber(row.net_to_firm) ?? 0,
    employee_share: toNumber(row.employee_share),
    retiree_share: toNumber(row.retiree_share),
    retiree_net_after_share: toNumber(row.retiree_net_after_share),
  };
}

function mapPeriod(row: SgkPeriodDbRow): SgkReimbursementPeriod {
  const rates = (row.sgk_reimbursement_profile_rates ?? [])
    .map(mapRate)
    .sort((a, b) => a.profile_id.localeCompare(b.profile_id, 'tr'));

  return {
    id: row.id,
    org_id: row.org_id,
    valid_from: row.valid_from,
    pill_extra_per_device: toNumber(row.pill_extra_per_device) ?? 0,
    created_at: row.created_at,
    rates,
  };
}

export async function fetchSgkReimbursementPeriods(): Promise<
  SgkReimbursementPeriod[]
> {
  const { data, error } = await supabaseClient
    .from('sgk_reimbursement_periods')
    .select(
      [
        'id',
        'org_id',
        'valid_from',
        'pill_extra_per_device',
        'created_at',
        'sgk_reimbursement_profile_rates(id, period_id, profile_id, label, gross, net_to_firm, employee_share, retiree_share, retiree_net_after_share)',
      ].join(', '),
    )
    .is('deleted_at', null)
    .order('valid_from', { ascending: false });

  if (error) {
    console.warn('SGK_REIMBURSEMENT_PERIODS_FALLBACK:', error);
    return [createFallbackSgkPeriod()];
  }

  const mapped = ((data ?? []) as unknown as SgkPeriodDbRow[]).map(mapPeriod);
  return mapped.length > 0 ? mapped : [createFallbackSgkPeriod()];
}

export function useSgkReimbursementPeriods() {
  return useQuery({
    queryKey: SGK_REIMBURSEMENT_PERIODS_QUERY_KEY,
    queryFn: fetchSgkReimbursementPeriods,
    staleTime: 1000 * 60 * 10,
  });
}

export async function saveSgkReimbursementPeriod(
  input: SaveSgkReimbursementPeriodInput,
): Promise<string> {
  const { data, error } = await supabaseClient.rpc(
    'upsert_sgk_reimbursement_period',
    {
      p_valid_from: input.validFrom,
      p_pill_extra_per_device: input.pillExtraPerDevice,
      p_rates: input.rates,
    },
  );

  if (error) {
    console.error('SGK_REIMBURSEMENT_PERIOD_SAVE_ERROR:', error);
    throw new Error('SGK oran dönemi kaydedilemedi: ' + error.message);
  }

  return String(data ?? '');
}

export function findEffectiveSgkPeriod(
  periods: SgkReimbursementPeriod[] | undefined,
  effectiveDate: string | null | undefined,
): SgkReimbursementPeriod {
  const rows = periods && periods.length > 0 ? periods : [createFallbackSgkPeriod()];
  const dateKey = toSgkDateKey(effectiveDate);
  const sorted = [...rows].sort((a, b) => b.valid_from.localeCompare(a.valid_from));
  const matching = sorted.find((period) => period.valid_from <= dateKey);
  if (matching) return matching;
  return sorted[sorted.length - 1] ?? createFallbackSgkPeriod();
}

export function getSgkProfileLabelFromPeriods(
  periods: SgkReimbursementPeriod[] | undefined,
  profileId: string | null | undefined,
): string {
  if (!profileId) return '-';
  const match = (periods ?? [])
    .flatMap((period) => period.rates)
    .find((rate) => rate.profile_id === profileId);
  return match?.label ?? getSgkProfileLabel(profileId);
}

export function computeSgkSnapshot(params: {
  periods: SgkReimbursementPeriod[] | undefined;
  effectiveDate: string | null | undefined;
  profileId: string | null | undefined;
  deviceCount: '1' | '2' | number | null | undefined;
  pillPrescription: boolean;
}): SgkSnapshotCalculation {
  const effectiveDate = toSgkDateKey(params.effectiveDate);
  const period = findEffectiveSgkPeriod(params.periods, effectiveDate);
  const deviceCount =
    params.deviceCount === '2' || params.deviceCount === 2 ? 2 : 1;
  const rate = params.profileId
    ? period.rates.find((row) => row.profile_id === params.profileId) ?? null
    : null;
  const baseAmount = roundMoney((rate?.net_to_firm ?? 0) * deviceCount);
  const pillExtraAmount = params.pillPrescription
    ? roundMoney(period.pill_extra_per_device * deviceCount)
    : 0;
  const totalAmount = roundMoney(baseAmount + pillExtraAmount);

  return {
    period,
    rate,
    effectiveDate,
    deviceCount,
    pillPrescription: params.pillPrescription,
    baseAmount,
    pillExtraAmount,
    totalAmount,
    totalInput: totalAmount > 0 ? formatSgkMoneyInput(totalAmount) : '',
    expectedMonth: totalAmount > 0 ? addThreeMonthsMonthInput(effectiveDate) : '',
  };
}
