// src/features/profitCalculator/api.ts
// Summary: Supabase data access for the Profitability Calculator
// (device models, latest price by date, references).

import { supabaseClient } from '../../utils/supabaseClient';
import {
  DeviceModelOption,
  DeviceModelPriceRow,
  ReferenceOption,
} from './types';

// Supabase schema names
const DEVICE_MODEL_PRICES_TABLE = 'device_model_prices';
const REFERENCES_TABLE = 'references'; // Currently only id + full_name are used.

/**
 * Device model options:
 * Builds a distinct list of models (with brand + optional list price)
 * from device_model_prices.
 */
export async function fetchDeviceModelOptions(): Promise<DeviceModelOption[]> {
  const { data, error } = await supabaseClient
    .from(DEVICE_MODEL_PRICES_TABLE)
    .select('model, brand, list_price')
    .order('model', { ascending: true });

  if (error) {
    console.error('fetchDeviceModelOptions error:', error);
    throw error;
  }

  const seen = new Set<string>();
  const result: DeviceModelOption[] = [];

  for (const row of (data ?? []) as any[]) {
    if (!row.model) continue;
    if (seen.has(row.model)) continue;
    seen.add(row.model);

    result.push({
      model: row.model,
      brand: row.brand ?? null,
      listPrice:
        row.list_price !== null && row.list_price !== undefined
          ? Number(row.list_price)
          : null,
    });
  }

  return result;
}

/**
 * Returns the effective device purchase cost for a given model and date.
 *
 * SELECT *
 * FROM device_model_prices
 * WHERE model = X AND effective_from <= asOfDate
 * ORDER BY effective_from DESC
 * LIMIT 1;
 */
export async function fetchEffectiveDeviceCost(
  model: string,
  asOfDate: string,
): Promise<number | null> {
  if (!model || !asOfDate) return null;

  const { data, error } = await supabaseClient
    .from(DEVICE_MODEL_PRICES_TABLE)
    .select('id, org_id, brand, model, effective_from, purchase_cost, list_price')
    .eq('model', model)
    .lte('effective_from', asOfDate)
    .order('effective_from', { ascending: false })
    .limit(1);

  if (error) {
    console.error('fetchEffectiveDeviceCost error:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const row = (data as any[])[0] as DeviceModelPriceRow;
  if (row.purchase_cost == null) {
    return null;
  }

  return Number(row.purchase_cost);
}

/**
 * Reference list:
 * Right now we only read id + full_name from references.
 * Commission scheme is not stored in DB yet; user selects it manually.
 */
export async function fetchReferenceOptions(): Promise<ReferenceOption[]> {
  const { data, error } = await supabaseClient
    .from(REFERENCES_TABLE)
    .select('id, full_name')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('fetchReferenceOptions error:', error);
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.full_name ?? '',
    scheme: null,
    default_percent: null,
    default_fixed: null,
  }));
}
