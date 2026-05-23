// src/features/inventory/api.fetch.ts
// Summary: Supabase fetch helpers and React Query hook for listing inventory items.
// Integrations:
// - Supports UI-driven soft-delete visibility via SoftDeleteMode (active/deleted/all).
// - Resolves sold_patient_name from patients table (if sold_patient_id is set).
//
// Patch v2.2:
// - ADD: Select deleted_by + delete_reason.
// - KEEP: Default mode is 'active'.

import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type {
  InventoryItemRow,
  InventoryStatus,
  InventoryItemType,
} from './types';
import { INVENTORY_QUERY_KEY } from './api.keys';
import type { SoftDeleteMode } from '../../utils/softDelete/softDeleteTypes';

type FetchInventoryOptions = {
  mode?: SoftDeleteMode;
};

type SoftDeleteFilterQuery<TQuery> = {
  is(column: string, value: null): TQuery;
  not(column: string, operator: string, value: null): TQuery;
};

type InventoryItemDbRow = {
  id: string;
  org_id: string;
  brand: string;
  model: string;
  item_type: InventoryItemType;
  catalog_model_id: string | null;
  barcode: string | null;
  serial_no: string | null;
  ear_side: InventoryItemRow['ear_side'];
  status: InventoryStatus;
  purchase_price: unknown;
  list_price: unknown;
  device_price: unknown;
  sold_patient_id: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  delete_reason: string | null;
};

type PatientNameLookupRow = {
  id: string | null;
  full_name: string | null;
};

function applySoftDeleteModeFilter<TQuery extends SoftDeleteFilterQuery<TQuery>>(
  query: TQuery,
  mode: SoftDeleteMode,
): TQuery {
  if (mode === 'active') {
    return query.is('deleted_at', null);
  }
  if (mode === 'deleted') {
    return query.not('deleted_at', 'is', null);
  }
  return query; // all
}

/**
 * Fetch inventory items for current org.
 * Also resolves sold_patient_name from patients table (if sold_patient_id is set).
 */
export async function fetchInventoryItems(
  opts: FetchInventoryOptions = {},
): Promise<InventoryItemRow[]> {
  const mode = opts.mode ?? 'active';

  let q = supabaseClient
    .from('inventory_items')
    .select(
      `
      id,
      org_id,
      brand,
      model,
      item_type,
      catalog_model_id,
      barcode,
      serial_no,
      ear_side,
      status,
      purchase_price,
      list_price,
      device_price,
      sold_patient_id,
      sold_at,
      created_at,
      updated_at,
      deleted_at,
      deleted_by,
      delete_reason
    `,
    )
    .order('created_at', { ascending: false });

  q = applySoftDeleteModeFilter(q, mode);

  const { data, error } = await q;

  if (error) {
    console.error('Supabase inventory fetch error:', error);
    throw error;
  }

  const baseRows = ((data ?? []) as InventoryItemDbRow[]).map(
    (row): InventoryItemRow => ({
      id: row.id as string,
      org_id: row.org_id as string,
      brand: row.brand as string,
      model: row.model as string,
      item_type: row.item_type as InventoryItemType,
      catalog_model_id: (row.catalog_model_id as string | null) ?? null,
      barcode: (row.barcode as string | null) ?? null,
      serial_no: (row.serial_no as string | null) ?? null,
      ear_side: (row.ear_side as InventoryItemRow['ear_side']) ?? null,
      status: row.status as InventoryStatus,

      purchase_price:
        row.purchase_price == null ? null : Number(row.purchase_price),

      list_price: row.list_price == null ? null : Number(row.list_price),

      device_price:
        row.device_price == null ? null : Number(row.device_price),

      sold_patient_id: (row.sold_patient_id as string | null) ?? null,
      sold_at: (row.sold_at as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      deleted_at: (row.deleted_at as string | null) ?? null,

      deleted_by: (row.deleted_by as string | null) ?? null,
      delete_reason: (row.delete_reason as string | null) ?? null,

      sold_patient_name: null,
    }),
  );

  // Resolve patient names for sold items
  const soldIds = Array.from(
    new Set(
      baseRows
        .map((r) => r.sold_patient_id)
        .filter((id): id is string => !!id),
    ),
  );

  if (soldIds.length > 0) {
    const { data: patients, error: patientsError } = await supabaseClient
      .from('patients')
      .select('id, full_name')
      .in('id', soldIds);

    if (patientsError) {
      console.error('Supabase inventory patient lookup error:', patientsError);
      return baseRows;
    }

    const nameMap = new Map<string, string>();
    ((patients ?? []) as PatientNameLookupRow[]).forEach((p) => {
      if (p.id && p.full_name) nameMap.set(p.id, p.full_name);
    });

    baseRows.forEach((row) => {
      if (row.sold_patient_id) {
        row.sold_patient_name = nameMap.get(row.sold_patient_id) ?? null;
      }
    });
  }

  return baseRows;
}

/**
 * React Query hook to list inventory items.
 */
export function useInventoryItems(opts: FetchInventoryOptions = {}) {
  const mode = opts.mode ?? 'active';

  return useQuery({
    queryKey: [...INVENTORY_QUERY_KEY, { mode }] as const,
    queryFn: () => fetchInventoryItems({ mode }),
  });
}
