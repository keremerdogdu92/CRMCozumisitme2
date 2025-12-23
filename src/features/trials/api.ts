// src/features/trials/api.ts
// Summary: Supabase-backed API helpers and React Query keys for trial (deneme) data.
//
// Patch v2.0 (soft delete support):
// - Adds optional SoftDeleteMode-aware fetchers:
//   fetchTrials({ mode }) / fetchTrialsByReferenceId(referenceId, { mode })
// - Default behavior is "active" (deleted_at IS NULL) so staff/admin see clean lists.
// - Admin UI can switch to "deleted" or "all" without changing DB schema beyond deleted_at.

import { supabaseClient } from '../../utils/supabaseClient';
import type {
  TrialRow,
  NewTrialForm,
  DeviceModelPriceRow,
  TrialDeviceRow,
} from './types';
import type { SoftDeleteMode } from '../../utils/softDelete/softDeleteTypes';

export const TRIALS_QUERY_KEY = ['trials'] as const;

// Trials grouped by reference
export const TRIALS_BY_REFERENCE_QUERY_KEY = (referenceId: string) =>
  ['trials-by-reference', referenceId] as const;

// Device price lookup query keys
export const DEVICE_BRANDS_QUERY_KEY = ['device-model-brands'] as const;
export const DEVICE_MODELS_BY_BRAND_QUERY_KEY = (brand: string) =>
  ['device-models-by-brand', brand] as const;

// Trial devices per trial query key
export const TRIAL_DEVICES_BY_TRIAL_QUERY_KEY = (trialId: string) =>
  ['trial-devices-by-trial', trialId] as const;

type FetchTrialsOptions = {
  /**
   * Soft-delete visibility mode:
   * - active: only not-deleted rows (default)
   * - deleted: only deleted rows
   * - all: deleted + not-deleted rows
   */
  mode?: SoftDeleteMode;
};

function applySoftDeleteModeFilter(
  query: ReturnType<typeof supabaseClient.from>,
  mode: SoftDeleteMode,
) {
  if (mode === 'active') {
    return query.is('deleted_at', null);
  }
  if (mode === 'deleted') {
    // Supabase "IS NOT NULL" equivalent:
    return query.not('deleted_at', 'is', null);
  }
  return query; // all
}

export async function fetchTrials(
  opts: FetchTrialsOptions = {},
): Promise<TrialRow[]> {
  const mode = opts.mode ?? 'active';

  let q = supabaseClient.from('trials').select(
    `
      id,
      full_name,
      phone,
      first_meet_at,
      next_meet_at,
      created_at,
      reference_id,
      note,
      deleted_at
    `,
  );

  q = applySoftDeleteModeFilter(q, mode).order('created_at', {
    ascending: false,
  });

  const { data, error } = await q;

  if (error) {
    console.error('Supabase trials fetch error:', error);
    throw error;
  }

  return (data ?? []) as TrialRow[];
}

/**
 * Fetch trials for a single reference_id.
 */
export async function fetchTrialsByReferenceId(
  referenceId: string,
  opts: FetchTrialsOptions = {},
): Promise<TrialRow[]> {
  if (!referenceId) {
    return [];
  }

  const mode = opts.mode ?? 'active';

  let q = supabaseClient.from('trials').select(
    `
      id,
      full_name,
      phone,
      first_meet_at,
      next_meet_at,
      created_at,
      reference_id,
      note,
      deleted_at
    `,
  );

  q = applySoftDeleteModeFilter(q, mode)
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: false });

  const { data, error } = await q;

  if (error) {
    console.error('Supabase trials-by-reference fetch error:', error);
    throw error;
  }

  return (data ?? []) as TrialRow[];
}

/**
 * Lightweight search for trials by full_name.
 * Used by the Meetings subject picker to attach meetings to existing trial patients.
 *
 * NOTE:
 * - Defaults to active-only (deleted rows are excluded).
 * - Add an opts.mode parameter later only if you truly need to search deleted.
 */
export interface TrialLite {
  id: string;
  full_name: string;
}

export async function searchTrialsByName(
  query: string,
  limit = 10,
): Promise<TrialLite[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('trials')
    .select('id, full_name')
    .ilike('full_name', `%${trimmed}%`)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Supabase trials search error:', error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    full_name: row.full_name as string,
  }));
}

/**
 * Fetch distinct device brands visible to the current organization
 * from the current_device_catalog_prices_public view.
 */
export async function fetchDeviceBrands(): Promise<string[]> {
  const { data, error } = await supabaseClient
    .from('current_device_catalog_prices_public')
    .select('brand')
    .order('brand', { ascending: true });

  if (error) {
    console.error('Supabase device brands fetch error:', error);
    throw error;
  }

  const brands = (data ?? [])
    .map((row) => row.brand as string | null)
    .filter((b): b is string => !!b);

  // Deduplicate on the client side to avoid relying on DISTINCT support.
  const unique = Array.from(new Set(brands));
  return unique;
}

/**
 * Fetch device models and list prices for a given brand from the
 * current_device_catalog_prices_public view.
 */
export async function fetchDeviceModelsByBrand(
  brand: string,
): Promise<DeviceModelPriceRow[]> {
  if (!brand) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('current_device_catalog_prices_public')
    .select('id, brand, model, list_price')
    .eq('brand', brand)
    .order('model', { ascending: true });

  if (error) {
    console.error('Supabase device models fetch error:', error);
    throw error;
  }

  // Strongly type the result
  return (data ?? []).map((row) => ({
    id: row.id as string,
    brand: row.brand as string,
    model: row.model as string,
    list_price: Number(row.list_price),
  }));
}

/**
 * Fetch trial_devices rows for a single trial, enriched with
 * catalog model data via trial_devices_with_catalog_public view.
 */
export async function fetchTrialDevicesByTrialId(
  trialId: string,
): Promise<TrialDeviceRow[]> {
  if (!trialId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('trial_devices_with_catalog_public')
    .select(
      `
      id,
      side,
      brand,
      model,
      quote_price,
      list_price,
      purchase_price,
      item_type,
      battery_type,
      details,
      notes
    `,
    )
    .eq('trial_id', trialId)
    .order('id', { ascending: true });

  if (error) {
    console.error('Supabase trial devices fetch error:', error);
    throw error;
  }

  return (data ?? []) as TrialDeviceRow[];
}

function parsePriceStringToNumber(raw: string): number {
  const normalized = raw.replace(/\s/g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error('TRIAL_STEP_PRICE_PARSE: Invalid device quote price');
  }
  return value;
}

export async function createTrial(input: NewTrialForm): Promise<void> {
  // 0) Normalize device list and basic guard
  const effectiveDevices = (input.devices ?? []).filter(
    (d) => d.brand && d.model && d.quotePrice.trim(),
  );

  if (effectiveDevices.length === 0) {
    throw new Error(
      'TRIAL_STEP_DEVICE_REQUIRED: At least one device with brand, model and price is required',
    );
  }

  // 1) Current user
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) {
    console.error('Failed to get current user (TRIAL_STEP_USER):', userError);
    throw new Error('TRIAL_STEP_USER: ' + userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('TRIAL_STEP_USER: User not authenticated');
  }

  // 2) Profile → org_id
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      'Failed to load profile for org_id (TRIAL_STEP_PROFILE):',
      profileError,
    );
    throw new Error('TRIAL_STEP_PROFILE: ' + profileError.message);
  }

  if (!profile || !profile.org_id) {
    console.error('Profile org_id is missing (TRIAL_STEP_NO_ORG)', profile);
    throw new Error('TRIAL_STEP_NO_ORG: Profile org_id is missing');
  }

  // 3) Insert trial and get its id back
  const { data: insertedTrials, error: insertTrialError } = await supabaseClient
    .from('trials')
    .insert({
      org_id: profile.org_id,
      full_name: input.fullName.trim(),
      phone: input.phone.trim() || null,
      first_meet_at: input.firstMeetAt
        ? new Date(input.firstMeetAt).toISOString()
        : null,
      next_meet_at: input.nextMeetAt
        ? new Date(input.nextMeetAt).toISOString()
        : null,
      reference_id: input.referenceId ?? null,
      note: input.note.trim() || null,
    })
    .select('id')
    .limit(1);

  if (insertTrialError) {
    console.error('Failed to insert trial (TRIAL_STEP_INSERT):', insertTrialError);
    throw new Error('TRIAL_STEP_INSERT: ' + insertTrialError.message);
  }

  const trialId = insertedTrials?.[0]?.id as string | undefined;
  if (!trialId) {
    console.error('Trial insert did not return an id (TRIAL_STEP_NO_ID)', insertedTrials);
    throw new Error('TRIAL_STEP_NO_ID: Trial insert did not return an id');
  }

  // 4) Insert associated device rows
  const devicePayload = effectiveDevices.map((d) => ({
    org_id: profile.org_id,
    trial_id: trialId,
    side: d.side || null,
    brand: d.brand,
    model: d.model,
    quote_price: parsePriceStringToNumber(d.quotePrice),
  }));

  const { error: deviceInsertError } = await supabaseClient
    .from('trial_devices')
    .insert(devicePayload);

  if (deviceInsertError) {
    console.error(
      'Failed to insert trial devices (TRIAL_STEP_DEVICE_INSERT):',
      deviceInsertError,
    );
    throw new Error('TRIAL_STEP_DEVICE_INSERT: ' + deviceInsertError.message);
  }
}

/**
 * RPC wrapper: link a trial to a newly created patient and then delete the trial.
 *
 * Server-side logic:
 * - Checks org isolation (caller org, trial org, patient org).
 * - Moves meetings.trial_id → meetings.patient_id and sets meeting_type = 'patient'.
 * - Deletes the trial row.
 */
export async function linkTrialToPatientAndDelete(
  trialId: string,
  patientId: string,
): Promise<void> {
  if (!trialId || !patientId) {
    throw new Error(
      'TRIAL_LINK_INVALID_IDS: trialId and patientId are required for linking.',
    );
  }

  const { error } = await supabaseClient.rpc(
    'link_trial_to_patient_and_delete',
    {
      p_trial_id: trialId,
      p_patient_id: patientId,
    },
  );

  if (error) {
    console.error(
      'Supabase link_trial_to_patient_and_delete RPC error:',
      error,
    );
    throw new Error(
      `TRIAL_LINK_RPC_FAILED: ${error.message ?? 'Unknown Supabase RPC error'}`,
    );
  }
}
