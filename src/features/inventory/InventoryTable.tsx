// src/features/inventory/InventoryTable.tsx
// Table view for inventory items with basic filters.

import type { InventoryItemRow, InventoryStatus, InventoryItemType } from './types';

type Props = {
  items: InventoryItemRow[];
  statusFilter: InventoryStatus | 'all';
  typeFilter: InventoryItemType | 'all';
  search: string;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: InventoryStatus | 'all') => void;
  onTypeFilterChange: (value: InventoryItemType | 'all') => void;
};

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  return (
    value.toLocaleString('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + ' ₺'
  );
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
}

export function InventoryTable({
  items,
  statusFilter,
  typeFilter,
  search,
  onSearchChange,
  onStatusFilterChange,
  onTypeFilterChange,
}: Props) {
  const term = search.trim().toLowerCase();

  const filtered = items.filter((item) => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesType = typeFilter === 'all' || item.item_type === typeFilter;

    const matchesSearch =
      !term ||
      item.brand.toLowerCase().includes(term) ||
      item.model.toLowerCase().includes(term) ||
      (item.barcode ?? '').toLowerCase().includes(term) ||
      (item.serial_no ?? '').toLowerCase().includes(term);

    return matchesStatus && matchesType && matchesSearch;
  });

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        Henüz stokta kayıtlı ürün yok. Üstteki formdan yeni cihaz veya aksesuar ekleyebilirsiniz.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Durum:</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              onStatusFilterChange(e.target.value as InventoryStatus | 'all')
            }
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">Hepsi</option>
            <option value="in_stock">Stokta</option>
            <option value="sold">Satıldı</option>
            <option value="repair">Tamirde</option>
          </select>

          <span className="ml-3 text-slate-500">Tür:</span>
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value as any)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">Hepsi</option>
            <option value="hearing_aid">İşitme cihazı</option>
            <option value="charger">Şarj cihazı / aksesuar</option>
          </select>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Marka, model, barkod veya seri no ile ara..."
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 md:w-72"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-xs md:text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Eklenme</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Satış</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Hasta</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Marka</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Model</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Tür</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Kulak</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Barkod</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Seri No</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">
                Geliş Fiyatı
              </th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">
                Liste Fiyatı
              </th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Durum</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const isSold = item.status === 'sold';

              let earLabel = '-';
              if (isSold && item.ear_side) {
                earLabel =
                  item.ear_side === 'right'
                    ? 'Sağ'
                    : item.ear_side === 'left'
                    ? 'Sol'
                    : item.ear_side === 'bilateral'
                    ? 'Çift'
                    : 'Yok';
              }

              return (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {formatDate(item.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {isSold ? formatDate(item.sold_at) : '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {isSold ? item.sold_patient_name ?? '-' : '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-800">{item.brand}</td>
                  <td className="px-3 py-2 text-slate-800">{item.model}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {item.item_type === 'hearing_aid'
                      ? 'İşitme cihazı'
                      : 'Şarj cihazı / aksesuar'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{earLabel}</td>
                  <td className="px-3 py-2 text-slate-700">{item.barcode ?? '-'}</td>
                  <td className="px-3 py-2 text-slate-700">{item.serial_no ?? '-'}</td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {formatMoney(item.purchase_price)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {formatMoney(item.list_price)}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {item.status === 'in_stock'
                      ? 'Stokta'
                      : item.status === 'sold'
                      ? 'Satıldı'
                      : 'Tamirde'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-500">
        Not: Satış ve tamir akışları ileride hastalar ekranı ile entegre olduğunda
        &quot;Satıldı&quot; ve &quot;Tamirde&quot; durumları ve kulak yönü otomatik
        güncellenecek. Şimdilik stok takibi için manuel giriş yapabilirsiniz.
      </p>
    </div>
  );
}
