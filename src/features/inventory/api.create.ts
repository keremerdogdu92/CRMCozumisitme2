// src/features/inventory/api.create.ts
// Create-item Supabase mutation and React Query hook for Inventory.
//
// v2:
// - If purchasePrice & listPrice are both empty on the form,
//   auto-fill from current_device_model_prices_public based on
//   org_id + brand + model + item_type.
// - If user provides any price, use the manual values (old behavior).

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

  const trimmedPurchase = purchasePrice.trim();
  const trimmedList = listPrice.trim();

  let purchase_price: number | null = null;
  let list_price: number | null = null;

  if (trimmedPurchase || trimmedList) {
    // At least one price was manually entered → keep old behavior.
    purchase_price = trimmedPurchase ? parsePriceOrNull(trimmedPurchase) : null;
    list_price = trimmedList ? parsePriceOrNull(trimmedList) : null;
  } else {
    // Both price fields are empty → auto-fill from catalog view.
    const { data: priceRow, error: priceError } = await supabaseClient
      .from('current_device_model_prices_public')
      .select('list_price, purchase_price')
      .eq('org_id', profile.org_id)
      .eq('brand', brand.trim())
      .eq('model', model.trim())
      .eq('item_type', itemType as InventoryItemType)
      .maybeSingle();

    if (priceError) {
      console.error('Failed to load catalog price for inventory insert:', priceError);
      throw new Error('INVENTORY_CATALOG_PRICE: ' + priceError.message);
    }

    if (!priceRow) {
      // No catalog row for this brand/model/item_type/org → ask user to enter manually.
      throw new Error(
        'INVENTORY_CATALOG_PRICE: Bu marka/model için katalog fiyatı bulunamadı. Lütfen geliş ve liste fiyatlarını manuel girin.'
      );
    }

    purchase_price = priceRow.purchase_price ?? null;
    list_price = priceRow.list_price ?? null;
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
