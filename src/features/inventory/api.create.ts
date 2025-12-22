// src/features/inventory/api.create.ts
// Create-item Supabase mutation and React Query hook for Inventory.
//
// v2.0:
// - Eğer kullanıcı yeni stok eklerken hem purchasePrice hem listPrice alanını
//   boş bırakırsa, current_device_model_prices_public view'undan
//   (org_id + brand + model + item_type) kriteriyle katalog fiyatı çekilir.
// - Katalogta fiyat bulunamazsa, kullanıcıya "lütfen manuel fiyat gir" diyen
//   anlamlı bir hata döner.

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

  const orgId: string = profile.org_id as string;

  // Fiyat alanları:
  // - Eğer hem purchasePrice hem listPrice boş ise:
  //   → katalog view'undan (org_id + brand + model + item_type) için
  //     purchase_price + list_price çekilir.
  // - Eğer CSV/forma en az bir tanesi dolu ise:
  //   → kullanıcı girişi kullanılır (parsePriceOrNull).
  const hasPurchasePrice = purchasePrice.trim().length > 0;
  const hasListPrice = listPrice.trim().length > 0;

  let purchase_price: number | null = null;
  let list_price: number | null = null;

  if (!hasPurchasePrice && !hasListPrice) {
    // Katalogtan fiyatları çek
    const { data: catalogRow, error: catalogError } = await supabaseClient
      .from('current_device_model_prices_public')
      .select('purchase_price, list_price')
      .eq('org_id', orgId)
      .eq('brand', brand.trim())
      .eq('model', model.trim())
      .eq('item_type', itemType as InventoryItemType)
      .maybeSingle();

    if (catalogError) {
      console.error(
        'Failed to load catalog prices for inventory create:',
        catalogError,
      );
      throw new Error('INVENTORY_CATALOG: ' + catalogError.message);
    }

    if (!catalogRow) {
      throw new Error(
        'Katalogta bu marka + model + ürün tipi için fiyat bulunamadı. ' +
          'Lütfen geliş ve satış fiyatını manuel girin veya cihaz katalog fiyatlarını önce güncelleyin.',
      );
    }

    const toNumberOrNull = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const num = Number(v);
      if (!Number.isFinite(num)) return null;
      return Number(num.toFixed(2));
    };

    purchase_price = toNumberOrNull((catalogRow as any).purchase_price);
    list_price = toNumberOrNull((catalogRow as any).list_price);

    if (purchase_price === null && list_price === null) {
      throw new Error(
        'Katalogta bu marka + model için purchase_price ve list_price değerleri boş görünüyor. ' +
          'Lütfen fiyatları manuel girin veya cihaz katalog fiyatlarını güncelleyin.',
      );
    }
  } else {
    // Kullanıcının girdiği fiyatları kullan
    purchase_price = parsePriceOrNull(purchasePrice);
    list_price = parsePriceOrNull(listPrice);
  }

  // Form earSide → DB ear_side (charger and "none" → NULL)
  const ear_side_db =
    itemType === 'charger'
      ? null
      : earSide === 'none'
      ? null
      : earSide; // right | left | bilateral

  const { error: insertError } = await supabaseClient.from('inventory_items').insert({
    org_id: orgId,
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
