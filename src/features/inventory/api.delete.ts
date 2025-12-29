// src/features/inventory/api.delete.ts
// Summary: Soft delete / restore helpers for inventory_items.
// Integrations:
// - Calls SECURITY DEFINER RPCs:
//   - public.soft_delete_inventory_items(p_id, p_reason)
//   - public.restore_inventory_items(p_id)
// - Invalidates INVENTORY_QUERY_KEY on success.
//
// Security notes:
// - No client-side hard delete is used.
// - RPC enforces org_id via public.current_user_org_id() on the DB side.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import { INVENTORY_QUERY_KEY } from './api.keys';

export async function softDeleteInventoryItem(
  itemId: string,
  reason?: string | null,
): Promise<void> {
  if (!itemId) {
    throw new Error('INVENTORY_SOFT_DELETE_INVALID_ID: itemId is required');
  }

  const { error } = await supabaseClient.rpc('soft_delete_inventory_items', {
    p_id: itemId,
    p_reason: reason ?? null,
  });

  if (error) {
    console.error('Supabase soft_delete_inventory_items RPC error:', error);
    throw new Error(
      `INVENTORY_SOFT_DELETE_FAILED: ${error.message ?? 'Unknown RPC error'}`,
    );
  }
}

export async function restoreInventoryItem(itemId: string): Promise<void> {
  if (!itemId) {
    throw new Error('INVENTORY_RESTORE_INVALID_ID: itemId is required');
  }

  const { error } = await supabaseClient.rpc('restore_inventory_items', {
    p_id: itemId,
  });

  if (error) {
    console.error('Supabase restore_inventory_items RPC error:', error);
    throw new Error(
      `INVENTORY_RESTORE_FAILED: ${error.message ?? 'Unknown RPC error'}`,
    );
  }
}

export function useSoftDeleteInventoryItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { itemId: string; reason?: string | null }) =>
      softDeleteInventoryItem(args.itemId, args.reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });
    },
  });
}

export function useRestoreInventoryItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { itemId: string }) => restoreInventoryItem(args.itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });
    },
  });
}
