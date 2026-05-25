// src/features/inventory/InventoryTable.tsx
// Summary: Inventory list view with mobile cards + desktop table, including filters,
// per-user table preferences (visible columns + sorting), and export (CSV/XLSX).
// Integrations:
// - useTablePreferences(userId): visible columns and sorting persistence.
// - Soft-delete actions: receives onSoftDelete/onRestore callbacks from the page.
// - Mobile-first layout: cards below md, table above md.
//
// Patch v2.4:
// - CHANGE: "actions" column is toggleable via Columns menu (already supported by useTablePreferences).
// - CHANGE: If actions column is hidden, row action buttons are not rendered.
// - CHANGE: Export always excludes actions column.

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

  canManageSoftDelete: boolean;
  onEdit: (item: InventoryItemRow) => void;
  onSoftDelete: (item: InventoryItemRow) => void;
  onRestore: (item: InventoryItemRow) => void;

  isMutating?: boolean;
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
  | 'status'
  | 'actions';

const INVENTORY_COLUMNS: TableColumnDef<InventoryItemRow>[] = [
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
  {
    id: 'actions',
    label: 'İşlemler',
    sortable: false,
    isDefaultVisible: true,
    // Intentionally no exportAccessor.
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

function getStatusLabel(status: InventoryStatus): string {
  if (status === 'sold') return 'Satıldı';
  if (status === 'repair') return 'Tamirde';
  return 'Stokta';
}

function getStatusBadgeClass(status: InventoryStatus): string {
  if (status === 'in_stock') return 'bg-emerald-50 text-emerald-700';
  if (status === 'sold') return 'bg-sky-50 text-sky-700';
  return 'bg-amber-50 text-amber-700';
}

export function InventoryTable({
  items,
  statusFilter,
  typeFilter,
  search,
  onSearchChange,
  onStatusFilterChange,
  onTypeFilterChange,
  canManageSoftDelete,
  onEdit,
  onSoftDelete,
  onRestore,
  isMutating,
}: Props) {
  const term = search.trim().toLowerCase();
  const { data: profile } = useCurrentProfile();
  const userId = profile?.id ?? null;
  const canRestore = profile?.role === 'admin';

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

  const actionsVisible = isColumnVisible('actions');

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
        (row as Record<string, unknown>)[col.id]);

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

      const av = va as number;
      const bv = vb as number;
      if (av < bv) return prefsState.sortDir === 'asc' ? -1 : 1;
      if (av > bv) return prefsState.sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [filtered, prefsState.sortBy, prefsState.sortDir]);

  const handleExport = (type: 'csv' | 'xlsx') => {
    const exportableColumns = visibleColumns.filter((c) => c.id !== 'actions');
    if (exportableColumns.length === 0) return;

    const headers = exportableColumns.map(
      (col) => col.exportLabel ?? col.label,
    );

    const rows = sorted.map((item) =>
      exportableColumns.map((col) => {
        const id = col.id as InventoryTableColumnId;
        const customExport = col.exportAccessor?.(item);
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
      exportToCsvFile({ fileName: baseFileName, headers, rows });
    } else {
      exportToXlsxFile({ fileName: baseFileName, headers, rows });
    }
  };

  const renderRowActions = (item: InventoryItemRow) => {
    if (!canManageSoftDelete) return <span className="text-slate-400">-</span>;

    const isDeleted = !!item.deleted_at;

    if (isDeleted) {
      if (!canRestore) return <span className="text-slate-400">-</span>;

      return (
        <button
          type="button"
          disabled={!!isMutating}
          onClick={() => onRestore(item)}
          className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          title="Silinen kaydı geri al"
        >
          Geri Al
        </button>
      );
    }

    return (
      <div className="inline-flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={!!isMutating}
          onClick={() => onEdit(item)}
          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          title="Stok urun bilgilerini duzenle"
        >
          Duzenle
        </button>
        <button
          type="button"
          disabled={!!isMutating}
          onClick={() => onSoftDelete(item)}
          className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
          title="Kaydı soft delete ile sil"
        >
          Sil
        </button>
      </div>
    );
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
          const isDeleted = !!item.deleted_at;

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
              className={
                'rounded-lg border px-3 py-3 shadow-sm ' +
                (isDeleted
                  ? 'border-rose-200 bg-rose-50/40'
                  : 'border-slate-200 bg-white')
              }
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
                    {isDeleted && item.deleted_at
                      ? ` · Silindi: ${formatDate(item.deleted_at)}`
                      : ''}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={
                      'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                      getStatusBadgeClass(item.status)
                    }
                  >
                    {getStatusLabel(item.status)}
                  </span>

                  {isDeleted && (
                    <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                      Silindi
                    </span>
                  )}
                </div>
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

              {/* Only render actions if the column is visible */}
              {actionsVisible && canManageSoftDelete && (
                <div className="mt-3 flex justify-end">
                  {renderRowActions(item)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop/tablet */}
      <ResponsiveTableShell className="hidden md:block">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-xs md:text-sm">
            <thead className="bg-slate-50">
              <tr>
                {visibleColumns.map((col) => {
                  const isSorted = prefsState.sortBy === col.id;
                  const showSortIcon = col.sortable;

                  let alignClass = 'text-left';
                  if (
                    col.id === 'purchase_price' ||
                    col.id === 'device_price' ||
                    col.id === 'actions'
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
                const isDeleted = !!item.deleted_at;

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
                  <tr
                    key={item.id}
                    className={
                      'border-t border-slate-100 ' +
                      (isDeleted ? 'bg-rose-50/40' : 'hover:bg-slate-50')
                    }
                  >
                    {visibleColumns.map((col) => {
                      switch (col.id as InventoryTableColumnId) {
                        case 'created_at':
                          return (
                            <td
                              key={col.id}
                              className="whitespace-nowrap px-3 py-2 text-slate-700 md:px-4 md:py-2.5"
                            >
                              {formatDate(item.created_at)}
                              {isDeleted && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                                  Silindi
                                </span>
                              )}
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
                              <span
                                className={
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                                  getStatusBadgeClass(item.status)
                                }
                              >
                                {getStatusLabel(item.status)}
                              </span>
                            </td>
                          );
                        case 'actions':
                          return (
                            <td
                              key={col.id}
                              className="whitespace-nowrap px-3 py-2 text-right md:px-4 md:py-2.5"
                            >
                              {renderRowActions(item)}
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
        </div>
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
