// src/pages/InventoryPage.tsx
// Inventory (stok) page: list + new item form.
// NOTE: CSV import işlemleri yalnızca Settings sayfasından yönetilir.

import { useState } from 'react';
import {
  useInventoryItems,
  useCreateInventoryItemMutation,
} from '../features/inventory/api';
import type {
  InventoryItemRow,
  InventoryItemType,
  InventoryStatus,
  NewInventoryItemForm,
} from '../features/inventory/types';
import { InventoryNewItemFormCard } from '../features/inventory/InventoryNewItemFormCard';
import { InventoryTable } from '../features/inventory/InventoryTable';

export default function InventoryPage() {
  const { data, isLoading, isError, error } = useInventoryItems();
  const createMutation = useCreateInventoryItemMutation();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | 'all'>(
    'all',
  );
  const [typeFilter, setTypeFilter] = useState<InventoryItemType | 'all'>(
    'all',
  );
  const [search, setSearch] = useState('');

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

  return (
    <div className="space-y-6 p-8">
      {/* Başlık + aksiyon butonu */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Stok</h2>
          <p className="mt-1 text-xs text-slate-500">
            Toplam {items.length} kayıtlı cihaz / aksesuar
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {showCreateForm ? 'Yeni Ürün Formunu Kapat' : 'Yeni Ürün'}
          </button>
        </div>
      </div>

      {/* Yeni ürün formu */}
      <InventoryNewItemFormCard
        open={showCreateForm}
        onToggle={() => setShowCreateForm((prev) => !prev)}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending}
        errorMessage={createMutation.isError ? mutationError : undefined}
      />

      {/* Stok tablosu */}
      <InventoryTable
        items={items}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        search={search}
        onSearchChange={setSearch}
        onStatusFilterChange={setStatusFilter}
        onTypeFilterChange={setTypeFilter}
      />
    </div>
  );
}
