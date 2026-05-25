// src/features/inventory/api.update.ts
// Update-item Supabase mutation for editable inventory details.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type {
  InventoryItemType,
  UpdateInventoryItemForm,
} from './types';
import { INVENTORY_QUERY_KEY } from './api.keys';
import { parsePriceOrNull } from './inventoryPriceUtils';
import { fetchCatalogPriceForInventory } from './api.catalog';

async function getCurrentOrgId(): Promise<string> {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw new Error('INVENTORY_UPDATE_USER: ' + userError.message);
  const user = userData.user;
  if (!user) throw new Error('INVENTORY_UPDATE_USER: Kullanici oturumu bulunamadi.');

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    throw new Error('INVENTORY_UPDATE_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    throw new Error('INVENTORY_UPDATE_NO_ORG: Profilde org_id bulunamadi.');
  }

  return profile.org_id as string;
}

export async function updateInventoryItemDetails(
  input: UpdateInventoryItemForm,
): Promise<void> {
  const brand = input.brand.trim();
  const model = input.model.trim();

  if (!input.id) throw new Error('Guncellenecek stok kaydi bulunamadi.');
  if (!brand) throw new Error('Marka alani bos birakilamaz.');
  if (!model) throw new Error('Model alani bos birakilamaz.');

  const orgId = await getCurrentOrgId();
  const catalogRow = await fetchCatalogPriceForInventory({
    orgId,
    brand,
    model,
    itemType: input.itemType as InventoryItemType,
  });

  const earSide =
    input.itemType === 'charger' || input.earSide === 'none'
      ? null
      : input.earSide;

  const { error } = await supabaseClient.rpc('update_inventory_item_details', {
    p_id: input.id,
    p_brand: brand,
    p_model: model,
    p_item_type: input.itemType,
    p_catalog_model_id: catalogRow?.catalogModelId ?? null,
    p_barcode: input.barcode.trim() || null,
    p_serial_no: input.serialNo.trim() || null,
    p_ear_side: earSide,
    p_purchase_price: parsePriceOrNull(input.purchasePrice),
    p_list_price: parsePriceOrNull(input.listPrice),
  });

  if (error) {
    throw new Error('INVENTORY_UPDATE: ' + error.message);
  }
}

export function useUpdateInventoryItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateInventoryItemDetails,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });
    },
  });
}
