// src/features/inventory/api.fetch.ts
// Supabase fetch helpers and React Query hook for listing inventory items.

import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type {
  InventoryItemRow,
  InventoryStatus,
  InventoryItemType,
} from './types';
import { INVENTORY_QUERY_KEY } from './api.keys';

/**
 * Fetch inventory items for current org.
 * Also resolves sold_patient_name from patients table (if sold_patient_id is set).
 */
export async function fetchInventoryItems(): Promise<InventoryItemRow[]> {
  const { data, error } = await supabaseClient
    .from('inventory_items')
    .select(
      `
      id,
      org_id,
      brand,
      model,
      item_type,
      barcode,
      serial_no,
      ear_side,
      status,
      purchase_price,
      list_price,
      sold_patient_id,
      sold_at,
      created_at,
      updated_at,
      deleted_at
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase inventory fetch error:', error);
    throw error;
  }

  const baseRows = (data ?? []).map((row: any): InventoryItemRow => ({
    id: row.id as string,
    org_id: row.org_id as string,
    brand: row.brand as string,
    model: row.model as string,
    item_type: row.item_type as InventoryItemType,
    barcode: (row.barcode as string | null) ?? null,
    serial_no: (row.serial_no as string | null) ?? null,
    ear_side: (row.ear_side as InventoryItemRow['ear_side']) ?? null,
    status: row.status as InventoryStatus,
    purchase_price:
      row.purchase_price === null ? null : Number(row.purchase_price),
    list_price: row.list_price === null ? null : Number(row.list_price),
    sold_patient_id: (row.sold_patient_id as string | null) ?? null,
    sold_at: (row.sold_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: (row.deleted_at as string | null) ?? null,
    sold_patient_name: null,
  }));

  // Resolve patient names for sold items (best-effort; UI should still work if this fails)
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
      console.error(
        'Supabase inventory patient lookup error:',
        patientsError,
      );
      return baseRows;
    }

    const nameMap = new Map<string, string>();
    (patients ?? []).forEach((p: any) => {
      if (p.id && p.full_name) {
        nameMap.set(p.id as string, p.full_name as string);
      }
    });

    baseRows.forEach((row) => {
      if (row.sold_patient_id) {
        row.sold_patient_name =
          nameMap.get(row.sold_patient_id) ?? null;
      }
    });
  }

  return baseRows;
}

/**
 * React Query hook to list inventory items.
 */
export function useInventoryItems() {
  return useQuery({
    queryKey: INVENTORY_QUERY_KEY,
    queryFn: fetchInventoryItems,
  });
}
