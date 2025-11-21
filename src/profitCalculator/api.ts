// src/features/profitCalculator/api.ts
// Summary: Supabase data access for the Profitability Calculator (device models, latest price by date, references).

import { supabase } from "../../utils/supabaseClient";
import {
  DeviceModelOption,
  DeviceModelPriceRow,
  ReferenceOption,
} from "./types";

// [NOTE] Adjust table + column names if your schema differs.

const DEVICE_MODEL_PRICES_TABLE = "device_model_prices";
const REFERENCES_TABLE = "reference_links"; // or 'references' if that's what you use

export async function fetchDeviceModelOptions(): Promise<DeviceModelOption[]> {
  const { data, error } = await supabase
    .from<DeviceModelPriceRow>(DEVICE_MODEL_PRICES_TABLE)
    .select("model, brand")
    .order("model", { ascending: true });

  if (error) {
    console.error("fetchDeviceModelOptions error:", error);
    throw error;
  }

  const seen = new Set<string>();
  const result: DeviceModelOption[] = [];

  for (const row of data ?? []) {
    if (!row.model) continue;
    if (seen.has(row.model)) continue;
    seen.add(row.model);
    result.push({
      model: row.model,
      brand: (row as any).brand ?? null,
    });
  }

  return result;
}

/**
 * Returns the effective device cost (C) for a given model and date.
 * Logic: device_model_prices WHERE model = X AND effective_from <= asOfDate
 *        ORDER BY effective_from DESC LIMIT 1
 */
export async function fetchEffectiveDeviceCost(
  model: string,
  asOfDate: string
): Promise<number | null> {
  if (!model || !asOfDate) return null;

  const { data, error } = await supabase
    .from<DeviceModelPriceRow>(DEVICE_MODEL_PRICES_TABLE)
    .select("id, model, effective_from, purchase_cost")
    .eq("model", model)
    .lte("effective_from", asOfDate)
    .order("effective_from", { ascending: false })
    .limit(1);

  if (error) {
    console.error("fetchEffectiveDeviceCost error:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0].purchase_cost;
}

/**
 * Returns references with default commission scheme if defined.
 * Assumes columns:
 *   id, name,
 *   scheme ('fixed' | 'percent' | null),
 *   default_percent (numeric, ex: 0.10),
 *   default_fixed (numeric, TL)
 */
export async function fetchReferenceOptions(): Promise<ReferenceOption[]> {
  const { data, error } = await supabase
    .from(REFERENCES_TABLE)
    .select("id, name, scheme, default_percent, default_fixed")
    .order("name", { ascending: true });

  if (error) {
    console.error("fetchReferenceOptions error:", error);
    throw error;
  }

  return (data ?? []) as ReferenceOption[];
}
