// src/features/profitCalculator/api.ts
// Summary: Supabase data access for the Profitability Calculator
// (device models, latest price by date, references).

import { supabaseClient } from '../../utils/supabaseClient';
import {
  DeviceModelOption,
  DeviceModelPriceRow,
  ReferenceOption,
} from './types';

// Supabase table / view names
const DEVICE_MODEL_PRICES_TABLE = 'device_model_prices';
const REFERENCES_TABLE = 'references'; // Şu an sadece isim + id çekiyoruz.

/**
 * Cihaz model seçenekleri:
 * device_model_prices içindeki model/brand kolonlarından distinct liste üretir.
 */
export async function fetchDeviceModelOptions(): Promise<DeviceModelOption[]> {
  const { data, error } = await supabaseClient
    // NOT: generic yok, şema zaten supabaseClient seviyesinde tanımlı
    .from(DEVICE_MODEL_PRICES_TABLE)
    .select('model, brand')
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
    });
  }

  return result;
}

/**
 * Belirli bir model için BUGÜNE kadar geçerli olan en güncel cihaz maliyetini döndürür.
 *
 * device_model_prices
 *   WHERE model = X AND effective_from <= today
 *   ORDER BY effective_from DESC
 *   LIMIT 1
 */
export async function fetchEffectiveDeviceCost(
  model: string,
): Promise<number | null> {
  if (!model) return null;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { data, error } = await supabaseClient
    .from(DEVICE_MODEL_PRICES_TABLE)
    .select('id, org_id, model, effective_from, purchase_cost')
    .eq('model', model)
    .lte('effective_from', today)
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
  return row.purchase_cost != null ? Number(row.purchase_cost) : null;
}

/**
 * Referans listesi:
 * Şu an sadece references tablosundan id + full_name çekiyoruz.
 * Komisyon şeması DB'de yok; kullanıcı ekranda manuel seçiyor.
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
