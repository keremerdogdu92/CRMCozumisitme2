// src/features/inventory/api.ts
// Supabase API helpers and React Query hooks for the Inventory feature.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type {
  EarSide,
  InventoryItemRow,
  InventoryStatus,
  InventoryItemType,
  NewInventoryItemForm,
} from './types';

export const INVENTORY_QUERY_KEY = ['inventory-items'] as const;

// Internal helper to parse price strings
function parsePriceOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
  const v = Number(normalized);
  if (!Number.isFinite(v) || v < 0) {
    throw new Error('Fiyat alanları için geçerli (0 veya üzeri) bir sayı girin.');
  }
  return Number(v.toFixed(2));
}

/**
 * Fetch inventory items for current org.
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
      updated_at
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase inventory fetch error:', error);
    throw error;
  }

  const rows = data ?? [];
  return rows.map((row: any) => ({
    id: row.id as string,
    org_id: row.org_id as string,
    brand: row.brand as string,
    model: row.model as string,
    item_type: row.item_type as InventoryItemType,
    barcode: (row.barcode as string | null) ?? null,
    serial_no: (row.serial_no as string | null) ?? null,
    ear_side: row.ear_side as EarSide,
    status: row.status as InventoryStatus,
    purchase_price: row.purchase_price === null ? null : Number(row.purchase_price),
    list_price: row.list_price === null ? null : Number(row.list_price),
    sold_patient_id: (row.sold_patient_id as string | null) ?? null,
    sold_at: (row.sold_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));
}

/**
 * Create a new inventory item using NewInventoryItemForm.
 */
export async function createInventoryItem(input: NewInventoryItemForm): Promise<void> {
  const { brand, model, itemType, earSide, barcode, serialNo, purchasePrice, listPrice } =
    input;

  if (!brand.trim()) {
    throw new Error('Marka alanı boş bırakılamaz.');
  }
  if (!model.trim()) {
    throw new Error('Model alanı boş bırakılamaz.');
  }

  const purchase_price = parsePriceOrNull(purchasePrice);
  const list_price = parsePriceOrNull(listPrice);

  // Current user → org_id
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) {
    console.error('Failed to get current user for inventory insert:', userError);
    throw new Error('INVENTORY_USER: ' + userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('INVENTORY_USER: Kullanıcı oturumu bulunamadı.');
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Failed to load profile for inventory insert:', profileError);
    throw new Error('INVENTORY_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    throw new Error('INVENTORY_NO_ORG: Profilde org_id bulunamadı.');
  }

  const { error: insertError } = await supabaseClient.from('inventory_items').insert({
    org_id: profile.org_id,
    brand: brand.trim(),
    model: model.trim(),
    item_type: itemType,
    ear_side: earSide,
    barcode: barcode.trim() || null,
    serial_no: serialNo.trim() || null,
    purchase_price,
    list_price,
    status: 'in_stock',
  });

  if (insertError) {
    console.error('Failed to insert inventory item:', insertError);
    throw new Error('INVENTORY_INSERT: ' + insertError.message);
  }
}

/**
 * React Query hooks
 */

export function useInventoryItems() {
  return useQuery({
    queryKey: INVENTORY_QUERY_KEY,
    queryFn: fetchInventoryItems,
  });
}

export function useCreateInventoryItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });
    },
  });
}
