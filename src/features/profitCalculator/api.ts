// src/features/profitCalculator/api.ts
// Summary: Supabase data access for the Profitability Calculator
// (device models, latest price info, chargers, references).

import { supabaseClient } from '../../utils/supabaseClient';
import {
  DeviceModelOption,
  DeviceModelPriceRow,
  DevicePriceInfo,
  ReferenceOption,
} from './types';

// Supabase view / table names
// NOTE: We use the *current* price view, not the historical table.
const DEVICE_MODEL_PRICES_TABLE = 'current_device_model_prices_public';
const REFERENCES_TABLE = 'references';

/**
 * Cihaz model seçenekleri:
 * current_device_model_prices_public içindeki
 * item_type = 'hearing_aid' kayıtlarından marka/model listesi üretir.
 */
export async function fetchDeviceModelOptions(): Promise<DeviceModelOption[]> {
  const { data, error } = await supabaseClient
    .from(DEVICE_MODEL_PRICES_TABLE)
    .select('brand, model, item_type, list_price, purchase_price')
    .eq('item_type', 'hearing_aid')
    .order('brand', { ascending: true })
    .order('model', { ascending: true });

  if (error) {
    console.error('fetchDeviceModelOptions error:', error);
    throw error;
  }

  const seen = new Set<string>();
  const result: DeviceModelOption[] = [];

  for (const row of (data ?? []) as any[]) {
    if (!row.model) continue;

    const brand = (row.brand ?? '').trim() || null;
    const key = `${brand ?? ''}|||${row.model}`;

    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      brand,
      model: row.model,
      itemType: row.item_type ?? null,
      listPrice: row.list_price != null ? Number(row.list_price) : null,
      purchasePrice:
        row.purchase_price != null ? Number(row.purchase_price) : null,
    });
  }

  return result;
}

/**
 * Şarj cihazı (charger) model seçenekleri:
 * item_type = 'charger' kayıtlarını aksesuar tarafında hızlı eklemek için kullanırız.
 */
export async function fetchChargerOptions(): Promise<DeviceModelOption[]> {
  const { data, error } = await supabaseClient
    .from(DEVICE_MODEL_PRICES_TABLE)
    .select('brand, model, item_type, list_price, purchase_price')
    .eq('item_type', 'charger')
    .order('brand', { ascending: true })
    .order('model', { ascending: true });

  if (error) {
    console.error('fetchChargerOptions error:', error);
    throw error;
  }

  const result: DeviceModelOption[] = [];

  for (const row of (data ?? []) as any[]) {
    if (!row.model) continue;

    const brand = (row.brand ?? '').trim() || null;

    result.push({
      brand,
      model: row.model,
      itemType: row.item_type ?? null,
      listPrice: row.list_price != null ? Number(row.list_price) : null,
      purchasePrice:
        row.purchase_price != null ? Number(row.purchase_price) : null,
    });
  }

  return result;
}

/**
 * Belirli bir model için geçerli cihaz maliyetini ve liste fiyatını döndürür.
 *
 * NOT:
 *  - Şu anda current_device_model_prices_public view'unu kullanıyoruz.
 *  - Bu view zaten "en güncel" satırı döndürüyor; asOfDate parametresi
 *    şimdilik sadece API uyumluluğu için var, SQL tarafında kullanılmıyor.
 */
export async function fetchEffectiveDeviceCost(
  model: string,
  asOfDate: string, // currently ignored, kept for future historical pricing
): Promise<DevicePriceInfo> {
  if (!model) {
    return { deviceCost: null, listPrice: null };
  }

  const { data, error } = await supabaseClient
    .from(DEVICE_MODEL_PRICES_TABLE)
    .select('model, item_type, list_price, purchase_price')
    .eq('model', model)
    .eq('item_type', 'hearing_aid')
    .limit(1);

  if (error) {
    console.error('fetchEffectiveDeviceCost error:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return { deviceCost: null, listPrice: null };
  }

  const row = (data[0] as any) as DeviceModelPriceRow;

  const deviceCost =
    row.purchase_price != null ? Number(row.purchase_price) : null;
  const listPrice =
    row.list_price != null ? Number(row.list_price) : null;

  return { deviceCost, listPrice };
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
