// src/features/inventory/InventoryTable.tsx
// Table view for inventory items with filters, column visibility toggles,
// sorting and export to CSV / XLSX (Excel).
//
// Export behavior:
// - Uses currently visible columns
// - Exports filtered + sorted rows
// - Money fields are exported as raw numbers (no currency symbol)
//
// Patch v2.1:
// - Existing: export buttons + column visibility + sorting + filters.
//
// Patch v2.2 (responsive polish):
// - ADD: Mobile card view (md altı) → daha okunabilir stok listesi.
// - Desktop/tablet için table görünümü ResponsiveTableShell içine alındı.
// - Filter satırı mobile-first hale getirildi (daha iyi wrap ve spacing).
// - Masaüstü davranışı ve export mantığı değişmedi.

import { useMemo } from 'react';
import type {
  InventoryItemRow,
  InventoryStatus,
  InventoryItemType,
} from './types';
import { useTablePreferences } from '../../components/table/useTablePreferences';
import { TableColumnsControl } from '../../components/table/TableColumnsControl';
import type { TableColumnDef } from '../../components/table/tableTypes';
import { useCurrentProfile } from '../auth/useCurrentProfile';
import {
  exportToCsvFile,
  exportToXlsxFile,
} from '../../utils/csvUtils';
import { TableExportButtons } from '../../components/table/TableExportButtons';
import { ResponsiveTableShell } from '../../components/layout/ResponsiveTableShell';

type Props = {
  items: InventoryItemRow[];
  statusFilter: InventoryStatus | 'all';
  typeFilter: InventoryItemType | 'all';
  search: string;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: InventoryStatus | 'all') => void;
  onTypeFilterChange: (value: InventoryItemType | 'all') => void;
};

type InventoryTableColumnId =
  | 'created_at'
  | 'sold_at'
  | 'sold_patient_name'
  | 'brand'
  | 'model'
  | 'item_type'
  | 'ear_side'
  | 'barcode'
  | 'serial_no'
  | 'purchase_price'
  | 'device_price'
  | 'status';

const INVENTORY_COLUMNS: TableColumnDef<
  InventoryItemRow & { _colId?: InventoryTableColumnId }
>[] = [
  {
    id: 'created_at',
    label: 'Eklenme',
    sortable: true,
    isDefaultVisible: true,
    accessor: (i) => i.created_at ?? null,
    exportAccessor: (i) => i.created_at ?? null,
  },
  {
    id: 'sold_at',
    label: 'Satış',
    sortable: true,
    isDefaultVisible: true,
    accessor: (i) => i.sold_at ?? null,
    exportAccessor: (i) => i.sold_at ?? null,
  },
  {
    id: 'sold_patient_name',
    label: 'Hasta',
    sortable: true,
    isDefaultVisible: true,
    accessor: (i) => i.sold_patient_name ?? '',
    exportAccessor: (i) => i.sold_patient_name ?? '',
  },
  {
    id: 'brand',
    label: 'Marka',
    sortable: true,
    isDefaultVisible: true,
    accessor: (i) => i.brand ?? '',
    exportAccessor: (i) => i.brand ?? '',
  },
  {
    id: 'model',
    label: 'Model',
    sortable: true,
    isDefaultVisible: true,
    accessor: (i) => i.model ?? '',
    exportAccessor: (i) => i.model ?? '',
  },
  {
    id: 'item_type',
    label: 'Tür',
    sortable: true,
    isDefaultVisible: true,
    accessor: (i) => i.item_type,
    exportAccessor: (i) => i.item_type,
  },
  {
    id: 'ear_side',
    label: 'Kulak',
    sortable: false,
    isDefaultVisible: true,
    accessor: (i) => i.ear_side ?? 'none',
    exportAccessor: (i) => i.ear_side ?? 'none',
  },
  {
    id: 'barcode',
    label: 'Barkod',
    sortable: true,
    isDefaultVisible: true,
    accessor: (i) => i.barcode ?? '',
    exportAccessor: (i) => i.barcode ?? '',
  },
  {
    id: 'serial_no',
    label: 'Seri No',
    sortable: true,
    isDefaultVisible: true,
    accessor: (i) => i.serial_no ?? '',
    exportAccessor: (i) => i.serial_no ?? '',
  },
  {
    id: 'purchase_price',
    label: 'Geliş Fiyatı',
    sortable: true,
    isDefaultVisible: true,
    accessor: (i) => i.purchase_price ?? 0,
    exportAccessor: (i) => i.purchase_price ?? null,
  },
  {
    id: 'device_price',
    label: 'Satış Fiyatı (Cihaz)',
    sortable: true,
    isDefaultVisible: true,
    accessor: (i) => i.device_price ?? 0,
    exportAccessor: (i) => i.device_price ?? null,
  },
  {
    id: 'status',
    label: 'Durum',
    sortable: true,
    isDefaultVisible: true,
    accessor: (i) =>
      i.status === 'in_stock' ? 0 : i.status === 'sold' ? 1 : 2,
    exportAccessor: (i) => i.status,
  },
];

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
  const { data: profile } = useCurrentProfile();
  const userId = profile?.id ?? null;

  const {
    state: prefsState,
    visibleColumns,
    toggleColumn,
    setSort,
    isColumnVisible,
  } = useTablePreferences<InventoryItemRow>(
    'inventory-table',
    INVENTORY_COLUMNS,
    userId,
  );

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesStatus =
        statusFilter === 'all' || item.status === statusFilter;
      const matchesType =
        typeFilter === 'all' || item.item_type === typeFilter;

      const brand = (item.brand ?? '').toLowerCase();
      const model = (item.model ?? '').toLowerCase();
      const barcode = (item.barcode ?? '').toLowerCase();
      const serial = (item.serial_no ?? '').toLowerCase();

      const matchesSearch =
        !term ||
        brand.includes(term) ||
        model.includes(term) ||
        barcode.includes(term) ||
        serial.includes(term);

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [items, statusFilter, typeFilter, term]);

  const sorted = useMemo(() => {
    if (!prefsState.sortBy) return filtered;

    const col = INVENTORY_COLUMNS.find((c) => c.id === prefsState.sortBy);
    if (!col || !col.sortable) return filtered;

    const accessor =
      col.accessor ??
      ((row: InventoryItemRow) =>
        (row as any)[col.id as keyof InventoryItemRow]);

    const result = [...filtered];
    result.sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);

      const aNull = va == null;
      const bNull = vb == null;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      if (typeof va === 'string' && typeof vb === 'string') {
        const aTime = Date.parse(va);
        const bTime = Date.parse(vb);
        if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) {
          if (aTime < bTime) return prefsState.sortDir === 'asc' ? -1 : 1;
          if (aTime > bTime) return prefsState.sortDir === 'asc' ? 1 : -1;
          return 0;
        }
        if (va < vb) return prefsState.sortDir === 'asc' ? -1 : 1;
        if (va > vb) return prefsState.sortDir === 'asc' ? 1 : -1;
        return 0;
      }

      if (typeof va === 'number' && typeof vb === 'number') {
        if (va < vb) return prefsState.sortDir === 'asc' ? -1 : 1;
        if (va > vb) return prefsState.sortDir === 'asc' ? 1 : -1;
        return 0;
      }

      const av = va as any;
      const bv = vb as any;
      if (av < bv) return prefsState.sortDir === 'asc' ? -1 : 1;
      if (av > bv) return prefsState.sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [filtered, prefsState.sortBy, prefsState.sortDir]);

  const handleExport = (type: 'csv' | 'xlsx') => {
    if (visibleColumns.length === 0) return;

    const headers = visibleColumns.map(
      (col) => col.exportLabel ?? col.label,
    );

    const rows = sorted.map((item) =>
      visibleColumns.map((col) => {
        const id = col.id as InventoryTableColumnId;
        const customExport =
          col.exportAccessor?.(item as any as InventoryItemRow);
        if (customExport !== undefined) return customExport;

        switch (id) {
          case 'created_at':
            return item.created_at ?? null;
          case 'sold_at':
            return item.sold_at ?? null;
          case 'sold_patient_name':
            return item.sold_patient_name ?? '';
          case 'brand':
            return item.brand ?? '';
          case 'model':
            return item.model ?? '';
          case 'item_type':
            return item.item_type;
          case 'ear_side':
            return item.ear_side ?? 'none';
          case 'barcode':
            return item.barcode ?? '';
          case 'serial_no':
            return item.serial_no ?? '';
          case 'purchase_price':
            return item.purchase_price ?? null;
          case 'device_price':
            return item.device_price ?? null;
          case 'status':
            return item.status;
          default:
            return '';
        }
      }),
    );

    const baseFileName = 'inventory_export';

    if (type === 'csv') {
      exportToCsvFile({
        fileName: baseFileName,
        headers,
        rows,
      });
    } else {
      exportToXlsxFile({
        fileName: baseFileName,
        headers,
        rows,
      });
    }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-xs text-slate-500 sm:px-6 sm:py-6 sm:text-sm">
        Henüz stokta kayıtlı ürün yok. Üstteki formdan yeni cihaz veya aksesuar
        ekleyebilirsiniz.
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="space-y-3">
        {/* Filters row with export controls */}
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
              onChange={(e) =>
                onTypeFilterChange(e.target.value as InventoryItemType | 'all')
              }
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">Hepsi</option>
              <option value="hearing_aid">İşitme cihazı</option>
              <option value="charger">Şarj cihazı / aksesuar</option>
            </select>
          </div>

          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Marka, model, barkod veya seri no ile ara..."
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-72 sm:text-sm"
            />
            <div className="flex items-center justify-end gap-2">
              <TableColumnsControl
                columns={INVENTORY_COLUMNS}
                isColumnVisible={isColumnVisible}
                toggleColumn={toggleColumn}
              />
              <TableExportButtons
                onExportCsv={() => handleExport('csv')}
                onExportXlsx={() => handleExport('xlsx')}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-xs text-slate-500 sm:px-5 sm:py-4 sm:text-sm">
          Filtreye uyan stok kaydı bulunamadı. Aramayı veya filtreleri
          güncelleyebilirsiniz.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters row with export controls */}
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
            onChange={(e) =>
              onTypeFilterChange(e.target.value as InventoryItemType | 'all')
            }
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">Hepsi</option>
            <option value="hearing_aid">İşitme cihazı</option>
            <option value="charger">Şarj cihazı / aksesuar</option>
          </select>
        </div>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Marka, model, barkod veya seri no ile ara..."
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-72 sm:text-sm"
          />
          <div className="flex items-center justify-end gap-2">
            <TableColumnsControl
              columns={INVENTORY_COLUMNS}
              isColumnVisible={isColumnVisible}
              toggleColumn={toggleColumn}
            />
            <TableExportButtons
              onExportCsv={() => handleExport('csv')}
              onExportXlsx={() => handleExport('xlsx')}
            />
          </div>
        </div>
      </div>

      {/* Mobile: card list (md altı) */}
      <div className="space-y-3 md:hidden">
        {sorted.map((item) => {
          const isSold = item.status === 'sold';

          let earLabel = '-';
          if (item.ear_side) {
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
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {(item.brand ?? '-').trim() || '-'}{' '}
                    {item.model ? `· ${item.model}` : ''}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Eklenme: {formatDate(item.created_at)}
                    {isSold && item.sold_at
                      ? ` · Satış: ${formatDate(item.sold_at)}`
                      : ''}
                  </p>
                </div>
                <span
                  className={
                    'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                    (item.status === 'in_stock'
                      ? 'bg-emerald-50 text-emerald-700'
                      : item.status === 'sold'
                      ? 'bg-sky-50 text-sky-700'
                      : 'bg-amber-50 text-amber-700')
                  }
                >
                  {item.status === 'in_stock'
                    ? 'Stokta'
                    : item.status === 'sold'
                    ? 'Satıldı'
                    : 'Tamirde'}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-slate-700 sm:grid-cols-2">
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Barkod
                  </span>
                  <span className="font-medium">
                    {item.barcode && item.barcode.trim().length > 0
                      ? item.barcode
                      : '-'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Seri No
                  </span>
                  <span className="font-medium">
                    {item.serial_no && item.serial_no.trim().length > 0
                      ? item.serial_no
                      : '-'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Tür
                  </span>
                  <span className="font-medium">
                    {item.item_type === 'hearing_aid'
                      ? 'İşitme cihazı'
                      : 'Şarj cihazı / aksesuar'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Kulak
                  </span>
                  <span className="font-medium">{earLabel}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Geliş Fiyatı
                  </span>
                  <span className="font-semibold">
                    {formatMoney(item.purchase_price)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400">
                    Satış Fiyatı (Cihaz)
                  </span>
                  <span className="font-semibold">
                    {formatMoney(item.device_price)}
                  </span>
                </div>
                {isSold && (
                  <div className="sm:col-span-2">
                    <span className="block text-[10px] uppercase text-slate-400">
                      Satılan Hasta
                    </span>
                    <span className="font-medium">
                      {item.sold_patient_name && item.sold_patient_name.trim()
                        ? item.sold_patient_name
                        : '-'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop / tablet: classic table (md ve üzeri) */}
      <ResponsiveTableShell className="hidden md:block">
        <table className="min-w-full text-xs md:text-sm">
          <thead className="bg-slate-50">
            <tr>
              {visibleColumns.map((col) => {
                const isSorted = prefsState.sortBy === col.id;
                const showSortIcon = col.sortable;

                let alignClass = 'text-left';
                if (
                  col.id === 'purchase_price' ||
                  col.id === 'device_price'
                ) {
                  alignClass = 'text-right';
                }

                return (
                  <th
                    key={col.id}
                    className={`px-3 py-2 text-[11px] font-medium text-slate-600 md:px-4 md:py-2.5 md:text-xs ${alignClass} ${
                      col.sortable ? 'cursor-pointer select-none' : ''
                    }`}
                    onClick={() => col.sortable && setSort(col.id)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {showSortIcon && isSorted && (
                        <span className="text-[10px]">
                          {prefsState.sortDir === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const isSold = item.status === 'sold';

              let earLabel = '-';
              if (item.ear_side) {
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
                  {visibleColumns.map((col) => {
                    switch (col.id as InventoryTableColumnId) {
                      case 'created_at':
                        return (
                          <td
                            key={col.id}
                            className="whitespace-nowrap px-3 py-2 text-slate-700 md:px-4 md:py-2.5"
                          >
                            {formatDate(item.created_at)}
                          </td>
                        );
                      case 'sold_at':
                        return (
                          <td
                            key={col.id}
                            className="whitespace-nowrap px-3 py-2 text-slate-700 md:px-4 md:py-2.5"
                          >
                            {isSold ? formatDate(item.sold_at) : '-'}
                          </td>
                        );
                      case 'sold_patient_name':
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2 text-slate-700 md:px-4 md:py-2.5"
                          >
                            {isSold ? item.sold_patient_name ?? '-' : '-'}
                          </td>
                        );
                      case 'brand':
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2 text-slate-800 md:px-4 md:py-2.5"
                          >
                            {item.brand}
                          </td>
                        );
                      case 'model':
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2 text-slate-800 md:px-4 md:py-2.5"
                          >
                            {item.model}
                          </td>
                        );
                      case 'item_type':
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2 text-slate-700 md:px-4 md:py-2.5"
                          >
                            {item.item_type === 'hearing_aid'
                              ? 'İşitme cihazı'
                              : 'Şarj cihazı / aksesuar'}
                          </td>
                        );
                      case 'ear_side':
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2 text-slate-700 md:px-4 md:py-2.5"
                          >
                            {earLabel}
                          </td>
                        );
                      case 'barcode':
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2 text-slate-700 md:px-4 md:py-2.5"
                          >
                            {item.barcode ?? '-'}
                          </td>
                        );
                      case 'serial_no':
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2 text-slate-700 md:px-4 md:py-2.5"
                          >
                            {item.serial_no ?? '-'}
                          </td>
                        );
                      case 'purchase_price':
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2 text-right text-slate-700 md:px-4 md:py-2.5"
                          >
                            {formatMoney(item.purchase_price)}
                          </td>
                        );
                      case 'device_price':
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2 text-right text-slate-700 md:px-4 md:py-2.5"
                          >
                            {formatMoney(item.device_price)}
                          </td>
                        );
                      case 'status':
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2 text-slate-700 md:px-4 md:py-2.5"
                          >
                            {item.status === 'in_stock'
                              ? 'Stokta'
                              : item.status === 'sold'
                              ? 'Satıldı'
                              : 'Tamirde'}
                          </td>
                        );
                      default:
                        return null;
                    }
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </ResponsiveTableShell>

      <p className="text-[11px] text-slate-500">
        Not: Cihaz satış fiyatı (cihaz başına) device_price alanından
        gelmektedir; bu değer, hasta toplam satış tutarının cihaz sayısına
        paylaştırılmasıyla hesaplanmıştır. Katalog liste fiyatları (list_price)
        ayrı tabloda saklanır ve burada gösterilmez.
      </p>
    </div>
  );
}
