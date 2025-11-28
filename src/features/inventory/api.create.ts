// src/features/inventory/api.create.ts
// Create-item Supabase mutation and React Query hook for Inventory.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type { InventoryItemType, NewInventoryItemForm } from './types';
import { INVENTORY_QUERY_KEY } from './api.keys';
import { parsePriceOrNull } from './inventoryPriceUtils';

/**
 * Create a new inventory item using NewInventoryItemForm.
 */
export async function createInventoryItem(input: NewInventoryItemForm): Promise<void> {
  const {
    brand,
    model,
    itemType,
    earSide,
    barcode,
    serialNo,
    purchasePrice,
    listPrice,
  } = input;

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
    .select('id, org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Failed to load profile for inventory insert:', profileError);
    throw new Error('INVENTORY_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    throw new Error('INVENTORY_NO_ORG: Profilde org_id bulunamadı.');
  }

  // Form earSide → DB ear_side (charger and "none" → NULL)
  const ear_side_db =
    itemType === 'charger'
      ? null
      : earSide === 'none'
      ? null
      : earSide; // right | left | bilateral

  const { error: insertError } = await supabaseClient.from('inventory_items').insert({
    org_id: profile.org_id,
    brand: brand.trim(),
    model: model.trim(),
    item_type: itemType as InventoryItemType,
    ear_side: ear_side_db,
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
 * React Query mutation hook for creating an inventory item.
 */
export function useCreateInventoryItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });
    },
  });
}
