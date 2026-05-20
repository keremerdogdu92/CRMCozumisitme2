// src/features/inventory/api.importFix.ts
// Helpers for fixing one failed inventory import row from the Settings UI.

import { supabaseClient } from '../../utils/supabaseClient';
import type { InventoryItemType, InventoryStatus } from './types';

export type InventoryImportRowResolveInput = {
  rowId: number;
  brand: string;
  model: string;
  itemType: InventoryItemType;
  barcode: string | null;
  serialNo: string;
  status: InventoryStatus;
  purchasePrice: number | null;
  listPrice: number | null;
  purchaseDate: string | null;
  notes: string | null;
  resolutionNote: string | null;
};

export type InventoryDuplicateLookupRow = {
  id: string;
  brand: string;
  model: string;
  item_type: InventoryItemType;
  barcode: string | null;
  serial_no: string | null;
  status: InventoryStatus;
  sold_patient_id: string | null;
  sold_at: string | null;
  deleted_at: string | null;
};

export async function findActiveInventoryItemBySerial(
  serialNo: string,
): Promise<InventoryDuplicateLookupRow | null> {
  const trimmed = serialNo.trim();
  if (!trimmed) return null;

  const { data, error } = await supabaseClient
    .from('inventory_items')
    .select(
      'id, brand, model, item_type, barcode, serial_no, status, sold_patient_id, sold_at, deleted_at',
    )
    .eq('serial_no', trimmed)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('DUPLICATE_LOOKUP: ' + error.message);
  }

  return (data as InventoryDuplicateLookupRow | null) ?? null;
}

export async function resolveInventoryImportRow(
  input: InventoryImportRowResolveInput,
): Promise<string> {
  const { data, error } = await supabaseClient.rpc(
    'resolve_inventory_import_row',
    {
      p_row_id: input.rowId,
      p_brand: input.brand,
      p_model: input.model,
      p_item_type: input.itemType,
      p_barcode: input.barcode,
      p_serial_no: input.serialNo,
      p_status: input.status,
      p_purchase_price: input.purchasePrice,
      p_list_price: input.listPrice,
      p_purchase_date: input.purchaseDate,
      p_notes: input.notes,
      p_resolution_note: input.resolutionNote,
    },
  );

  if (error) {
    throw new Error('RESOLVE_INVENTORY_IMPORT_ROW: ' + error.message);
  }

  return data as string;
}
