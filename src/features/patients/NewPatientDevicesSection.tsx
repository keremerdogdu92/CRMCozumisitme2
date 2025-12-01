// src/features/patients/NewPatientDevicesSection.tsx
// Device draft section used in the "New Patient" form.
// Allows binding simple per-ear device rows to existing inventory items
// (inventory_items) via inventoryItemId, while still letting the user
// override brand/model/prices/note fields if needed.

import type { NewPatientDeviceDraft, NewPatientDeviceSide } from './types';
import { useInventoryItems } from '../inventory/api';
import type { InventoryItemRow } from '../inventory/types';

type NewPatientDevicesSectionProps = {
  items: NewPatientDeviceDraft[];
  onAddRow: () => void;
  onChangeRow: (
    index: number,
    patch: Partial<NewPatientDeviceDraft>,
  ) => void;
  onRemoveRow: (index: number) => void;
};

const SIDE_OPTIONS: { value: NewPatientDeviceSide; label: string }[] = [
  { value: '', label: 'Seçilmedi' },
  { value: 'right', label: 'Sağ' },
  { value: 'left', label: 'Sol' },
  { value: 'bilateral', label: 'Çift' },
];

export function NewPatientDevicesSection({
  items,
  onAddRow,
  onChangeRow,
  onRemoveRow,
}: NewPatientDevicesSectionProps) {
  const {
    data: inventory,
    isLoading: isInventoryLoading,
    isError: isInventoryError,
  } = useInventoryItems();

  // Stokta olan ve henüz herhangi bir hastaya bağlanmamış cihazlar.
  const availableInventory: InventoryItemRow[] =
    (inventory ?? []).filter(
      (row) => row.status === 'in_stock' && !row.sold_patient_id,
    );

  return (
    <div className="space-y-3">
      {isInventoryLoading && (
        <p className="text-[11px] text-slate-500">
          Stok listesi yükleniyor…
        </p>
      )}

      {isInventoryError && (
        <p className="text-[11px] text-red-600">
          Stok listesi alınırken bir hata oluştu. Cihaz seçimi şu an
          yapılamıyor.
        </p>
      )}

      {items.length === 0 && (
        <p className="text-[11px] text-slate-500">
          Henüz cihaz eklenmedi. Aşağıdan &quot;Cihaz ekle&quot; butonuna
          basarak kulak yönü seçip stoktan cihaz bağlayabilirsiniz.
        </p>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, index) => {
            // Bu satır hariç seçilmiş inventory id'leri
            const selectedOtherIds = items
              .map((r, i) => (i === index ? null : r.inventoryItemId))
              .filter((id): id is string => !!id);

            // Mevcut satır için uygun stok satırları:
            // - Henüz hiçbir satıra seçilmemiş olanlar
            // - Veya zaten bu satırda seçili olan (değiştirmeden görmek için)
            const options = availableInventory.filter(
              (row) =>
                !selectedOtherIds.includes(row.id) ||
                row.id === item.inventoryItemId,
            );

            const handleSelectInventory = (inventoryId: string | null) => {
              if (!inventoryId) {
                onChangeRow(index, {
                  inventoryItemId: null,
                });
                return;
              }

              const inv = availableInventory.find(
                (row) => row.id === inventoryId,
              );

              if (!inv) {
                onChangeRow(index, {
                  inventoryItemId: inventoryId,
                });
                return;
              }

              // Stoktan seçim yapıldığında boş alanları stok verisiyle doldur.
              onChangeRow(index, {
                inventoryItemId: inventoryId,
                brand: item.brand || inv.brand,
                model: item.model || inv.model,
                listPrice:
                  item.listPrice ||
                  (inv.list_price != null
                    ? inv.list_price.toString()
                    : ''),
              });
            };

            return (
              <div
                key={index}
                className="space-y-2 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700">
                    Cihaz #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveRow(index)}
                    className="text-[11px] font-medium text-red-600 hover:underline"
                  >
                    Sil
                  </button>
                </div>

                {/* Inventory selection row */}
                <div className="grid gap-2 md:grid-cols-12">
                  <div className="md:col-span-7">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Stoktan cihaz seç (opsiyonel)
                    </label>
                    <select
                      value={item.inventoryItemId ?? ''}
                      onChange={(e) =>
                        handleSelectInventory(
                          e.target.value ? e.target.value : null,
                        )
                      }
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">Stoktan seç…</option>
                      {options.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.brand} {row.model}
                          {row.barcode
                            ? ` • ${row.barcode}`
                            : row.serial_no
                            ? ` • ${row.serial_no}`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-5">
                    <p className="mt-5 text-[10px] text-slate-400">
                      Seçilen stok satırı, hasta kaydından sonra bu
                      hastaya &quot;satıldı&quot; olarak işaretlenir
                      (kulak yönüyle birlikte).
                    </p>
                  </div>
                </div>

                {/* Row 1: Side + Brand + Model */}
                <div className="grid gap-2 md:grid-cols-12">
                  <div className="md:col-span-3">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Kulak
                    </label>
                    <select
                      value={item.side}
                      onChange={(e) =>
                        onChangeRow(index, {
                          side: e.target.value as NewPatientDeviceSide,
                        })
                      }
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      {SIDE_OPTIONS.map((opt) => (
                        <option
                          key={opt.value || 'empty'}
                          value={opt.value}
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Marka
                    </label>
                    <input
                      type="text"
                      value={item.brand}
                      onChange={(e) =>
                        onChangeRow(index, { brand: e.target.value })
                      }
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="Örn. Widex, Phonak..."
                    />
                  </div>

                  <div className="md:col-span-5">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Model
                    </label>
                    <input
                      type="text"
                      value={item.model}
                      onChange={(e) =>
                        onChangeRow(index, { model: e.target.value })
                      }
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="Örn. Moment 330 R"
                    />
                  </div>
                </div>

                {/* Row 2: Prices */}
                <div className="grid gap-2 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Liste Fiyatı (tek cihaz)
                    </label>
                    <input
                      type="text"
                      value={item.listPrice}
                      onChange={(e) =>
                        onChangeRow(index, { listPrice: e.target.value })
                      }
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="Örn. 25.000"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Hastaya Satış (tek cihaz)
                    </label>
                    <input
                      type="text"
                      value={item.salePrice}
                      onChange={(e) =>
                        onChangeRow(index, { salePrice: e.target.value })
                      }
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="Örn. 22.500"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Not (opsiyonel)
                    </label>
                    <input
                      type="text"
                      value={item.note}
                      onChange={(e) =>
                        onChangeRow(index, { note: e.target.value })
                      }
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="Renk, paket, kampanya notu..."
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex items-center rounded-md border border-dashed border-primary-300 px-3 py-1.5 text-xs font-medium text-primary-700 hover:border-primary-400 hover:bg-primary-50"
        >
          Cihaz ekle
        </button>
      </div>
    </div>
  );
}
