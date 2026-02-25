// src/pages/InventoryPage.tsx
// Summary: Inventory (stok) page: list + new item form + soft-delete visibility filter.
// Integrations:
// - useInventoryItems({ mode }): loads inventory items with soft delete visibility.
// - SoftDeleteModeFilter: UI control for active/deleted/all.
// - Soft delete / restore mutations: inventory RPC wrappers.
// NOTE: CSV imports are managed only from Settings page.
//
// Patch v2.3:
// - CHANGE: SoftDeleteModeFilter is visible to all users (not admin-only).
// - KEEP: Row-level Soft Delete / Restore actions are still available via table actions column.
//         Access control remains on DB policies/RPCs.

import { useState } from 'react';
import {
  useInventoryItems,
  useCreateInventoryItemMutation,
  useSoftDeleteInventoryItemMutation,
  useRestoreInventoryItemMutation,
} from '../features/inventory/api';
import type {
  InventoryItemRow,
  InventoryItemType,
  InventoryStatus,
  NewInventoryItemForm,
} from '../features/inventory/types';
import { InventoryNewItemFormCard } from '../features/inventory/InventoryNewItemFormCard';
import { InventoryTable } from '../features/inventory/InventoryTable';
import { SoftDeleteModeFilter } from '../components/table/SoftDeleteModeFilter';
import type { SoftDeleteMode } from '../utils/softDelete/softDeleteTypes';

export default function InventoryPage() {
  const [softDeleteMode, setSoftDeleteMode] = useState<SoftDeleteMode>('active');

  const { data, isLoading, isError, error } = useInventoryItems({
    mode: softDeleteMode,
  });

  const createMutation = useCreateInventoryItemMutation();
  const softDeleteMutation = useSoftDeleteInventoryItemMutation();
  const restoreMutation = useRestoreInventoryItemMutation();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | 'all'>(
    'all',
  );
  const [typeFilter, setTypeFilter] = useState<InventoryItemType | 'all'>(
    'all',
  );
  const [search, setSearch] = useState('');

  const isMutating =
    createMutation.isPending ||
    softDeleteMutation.isPending ||
    restoreMutation.isPending;

  if (isLoading) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Stok verileri yükleniyor...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-sm text-red-600">
        Stok verileri alınırken bir hata oluştu:{' '}
        {(error as Error)?.message ?? 'Bilinmeyen hata'}
      </div>
    );
  }

  const items = (data ?? []) as InventoryItemRow[];

  const handleSubmit = (values: NewInventoryItemForm) => {
    createMutation.mutate(values);
  };

  const mutationError =
    (createMutation.error as Error | null | undefined)?.message ?? '';

  const handleSoftDelete = (item: InventoryItemRow) => {
    // Optional delete reason: keep UI minimal with prompt for now.
    // Caller can replace with a proper modal later.
    const reason = window.prompt('Silme nedeni (opsiyonel):', '');
    if (reason === null) return; // Cancel => abort

    softDeleteMutation.mutate({
      itemId: item.id,
      reason: reason.trim() || null,
    });
  };

  const handleRestore = (item: InventoryItemRow) => {
    restoreMutation.mutate({ itemId: item.id });
  };

  return (
    <div className="space-y-6 py-8">
      {/* Header + actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Stok</h2>
          <p className="mt-1 text-xs text-slate-500">
            Toplam {items.length} kayıtlı cihaz / aksesuar
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SoftDeleteModeFilter value={softDeleteMode} onChange={setSoftDeleteMode} />

          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {showCreateForm ? 'Yeni Ürün Formunu Kapat' : 'Yeni Ürün'}
          </button>
        </div>
      </div>

      {/* New item form */}
      <InventoryNewItemFormCard
        open={showCreateForm}
        onToggle={() => setShowCreateForm((prev) => !prev)}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending}
        errorMessage={createMutation.isError ? mutationError : undefined}
      />

      {/* Table */}
      <InventoryTable
        items={items}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        search={search}
        onSearchChange={setSearch}
        onStatusFilterChange={setStatusFilter}
        onTypeFilterChange={setTypeFilter}
        canManageSoftDelete={true}
        onSoftDelete={handleSoftDelete}
        onRestore={handleRestore}
        isMutating={isMutating}
      />
    </div>
  );
}
