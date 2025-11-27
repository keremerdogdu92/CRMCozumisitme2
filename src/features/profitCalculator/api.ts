// src/features/profitCalculator/api.ts
// Summary: Supabase data access for the Profitability Calculator
// (device models, latest price, references, chargers).

import { supabaseClient } from '../../utils/supabaseClient';
import {
  DeviceModelOption,
  ReferenceOption,
  ChargerOption,
} from './types';

// Supabase table / view names
const DEVICE_MODEL_PRICES_TABLE = 'device_model_prices';
const CURRENT_DEVICE_MODEL_PRICES_VIEW = 'current_device_model_prices_public';
const REFERENCES_TABLE = 'references'; // Şu an sadece isim + id çekiyoruz.

/**
 * Cihaz model seçenekleri:
 * Denemeler ekranında kullanılan current_device_model_prices_public view'undan
 * sadece hearing_aid olan model/brand listesini çekeriz.
 */
export async function fetchDeviceModelOptions(): Promise<DeviceModelOption[]> {
  const { data, error } = await supabaseClient
    .from(CURRENT_DEVICE_MODEL_PRICES_VIEW)
    .select('model, brand, item_type')
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
    const key = `${row.brand ?? ''}||${row.model}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      model: row.model,
      brand: row.brand ?? null,
    });
  }

  return result;
}

/**
 * Belirli bir model için EN GÜNCEL cihaz maliyetini döndürür.
 *
 * current_device_model_prices_public
 *   WHERE model = X
 *   (view zaten org + tarih mantığını çözüyor)
 *
 * Önce purchase_cost kullanılır; yoksa geçici olarak list_price maliyet
 * gibi kullanılır. İleride satın alma maliyetini doldurduğunda bu fallback
 * davranışı kaldırabilirsin.
 */
export async function fetchEffectiveDeviceCost(
  model: string,
  asOfDate: string, // Şimdilik imzada dursun; view zaten "en güncel" fiyatı döner.
): Promise<number | null> {
  if (!model) return null;

  const { data, error } = await supabaseClient
    .from(CURRENT_DEVICE_MODEL_PRICES_VIEW)
    .select('purchase_cost, list_price, model')
    .eq('model', model)
    .limit(1);

  if (error) {
    console.error('fetchEffectiveDeviceCost error:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const row = (data as any[])[0] as {
    purchase_cost?: number | null;
    list_price?: number | null;
  };

  if (row.purchase_cost != null) {
    return Number(row.purchase_cost);
  }

  if (row.list_price != null) {
    // [NOT]: Şimdilik list_price'ı maliyet gibi kullanıyoruz.
    return Number(row.list_price);
  }

  return null;
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

/**
 * Şarj cihazları listesi (aksesuar kısmında hazır ekleyebilmek için).
 * current_device_model_prices_public içinden item_type = 'charger' satırlarını çekeriz.
 */
export async function fetchChargerOptions(): Promise<ChargerOption[]> {
  const { data, error } = await supabaseClient
    .from(CURRENT_DEVICE_MODEL_PRICES_VIEW)
    .select('model, brand, item_type, purchase_cost, list_price')
    .eq('item_type', 'charger')
    .order('brand', { ascending: true })
    .order('model', { ascending: true });

  if (error) {
    console.error('fetchChargerOptions error:', error);
    throw error;
  }

  const result: ChargerOption[] = [];

  for (const row of (data ?? []) as any[]) {
    if (!row.model) continue;

    let cost: number | null = null;
    if (row.purchase_cost != null) {
      cost = Number(row.purchase_cost);
    } else if (row.list_price != null) {
      cost = Number(row.list_price);
    }

    if (cost == null) continue; // maliyeti olmayan şarj cihazını listelemeyelim

    result.push({
      model: row.model,
      brand: row.brand ?? null,
      purchaseCost: cost,
    });
  }

  return result;
}
