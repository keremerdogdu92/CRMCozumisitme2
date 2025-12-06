// src/features/patients/components/new/NewPatientDevicesSection.tsx
// Device draft section used in the "New Patient" form.
//
// Kurallar:
// - En az bir cihaz satırı her zaman açık gelir; ek satırlar "Cihaz ekle" ile eklenir.
// - Marka, stokta olan cihaz markalarından seçilir.
// - Model, seçilen markaya ait stok modellerinden seçilir.
// - Seri No, seçilen marka+model kombinasyonuna ve henüz hastaya bağlanmamış,
//   başka satırlarda da seçilmemiş stok cihazlarından seçilir.
// - Seri No seçilince inventoryItemId set edilir, brand/model/listPrice stoktan doldurulur.
// - Hastaya satış fiyatı cihaz bazında girilmez; toplam satış yukarıdaki ödeme alanında tutulur.

import type { NewPatientDeviceDraft } from '../../types';
import { useInventoryItems } from '../../../inventory/api';
import type { InventoryItemRow } from '../../../inventory/types';

type NewPatientDevicesSectionProps = {
  items: NewPatientDeviceDraft[];
  onAddRow: () => void;
  onChangeRow: (
    index: number,
    patch: Partial<NewPatientDeviceDraft>,
  ) => void;
  onRemoveRow: (index: number) => void;
};

const SIDE_OPTIONS = [
  { value: '', label: 'Seçilmedi' },
  { value: 'right', label: 'Sağ' },
  { value: 'left', label: 'Sol' },
  { value: 'bilateral', label: 'Çift' },
] as const;

export function NewPatientDevicesSection({
  items,
  onAddRow,
  onChangeRow,
  onRemoveRow,
}: NewPatientDevicesSectionProps) {
  const {
    data: inventory,
    isLoading,
    isError,
  } = useInventoryItems();

  // Stokta olan ve henüz bir hastaya bağlanmamış cihazlar.
  const availableInventory: InventoryItemRow[] =
    (inventory ?? []).filter(
      (row) =>
        row.status === 'in_stock' &&
        !row.sold_patient_id &&
        !row.deleted_at,
    );

  // Unique marka listesi
  const brandOptions = Array.from(
    new Set(availableInventory.map((row) => row.brand).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const selectedInventoryIds = items
    .map((d) => d.inventoryItemId)
    .filter((id): id is string => !!id);

  return (
    <div className="space-y-3">
      {isLoading && (
        <p className="text-[11px] text-slate-500">
          Stok listesi yükleniyor…
        </p>
      )}

      {isError && (
        <p className="text-[11px] text-red-600">
          Stok listesi alınırken bir hata oluştu. Cihaz seçimi şu an
          yapılamıyor.
        </p>
      )}

      {items.map((item, index) => {
        // Seçilen markaya göre modeller
        const modelOptions = Array.from(
          new Set(
            availableInventory
              .filter((row) => !item.brand || row.brand === item.brand)
              .map((row) => row.model)
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b));

        // Bu satır hariç seçilmiş inventory id'leri
        const otherSelectedIds = selectedInventoryIds.filter(
          (id) => id !== item.inventoryItemId,
        );

        // Seri numarası / stok seçenekleri
        const serialOptions = availableInventory.filter((row) => {
          if (otherSelectedIds.includes(row.id)) return false;
          if (item.brand && row.brand !== item.brand) return false;
          if (item.model && row.model !== item.model) return false;
          return true;
        });

        const handleSelectBrand = (brand: string) => {
          onChangeRow(index, {
            brand,
            // Marka değişince model ve inventory seçimleri resetlenir.
            model: '',
            inventoryItemId: null,
            listPrice: '',
          });
        };

        const handleSelectModel = (model: string) => {
          onChangeRow(index, {
            model,
            // Model değişince seri seçimleri resetlenir.
            inventoryItemId: null,
            listPrice: '',
          });
        };

        const handleSelectInventory = (inventoryId: string | null) => {
          if (!inventoryId) {
            onChangeRow(index, {
              inventoryItemId: null,
              listPrice: '',
            });
            return;
          }

          const inv = availableInventory.find(
            (row) => row.id === inventoryId,
          );
          if (!inv) {
            onChangeRow(index, { inventoryItemId: inventoryId });
            return;
          }

          onChangeRow(index, {
            inventoryItemId: inventoryId,
            brand: inv.brand || item.brand,
            model: inv.model || item.model,
            listPrice:
              inv.list_price != null
                ? inv.list_price.toString()
                : item.listPrice,
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
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveRow(index)}
                  className="text-[11px] font-medium text-red-600 hover:underline"
                >
                  Satırı sil
                </button>
              )}
            </div>

            {/* Kulak + Marka + Model */}
            <div className="grid gap-2 md:grid-cols-12">
              <div className="md:col-span-3">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Kulak
                </label>
                <select
                  value={item.side}
                  onChange={(e) =>
                    onChangeRow(index, {
                      side: e.target.value as NewPatientDeviceDraft['side'],
                    })
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  {SIDE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Marka (stok)
                </label>
                <select
                  value={item.brand}
                  onChange={(e) => handleSelectBrand(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Marka seç...</option>
                  {brandOptions.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-5">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Model (stok)
                </label>
                <select
                  value={item.model}
                  onChange={(e) => handleSelectModel(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  disabled={!item.brand}
                >
                  <option value="">
                    {item.brand ? 'Model seç...' : 'Önce marka seçin'}
                  </option>
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Seri No + info */}
            <div className="grid gap-2 md:grid-cols-12">
              <div className="md:col-span-6">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Seri No (stoktan bağla)
                </label>
                <select
                  value={item.inventoryItemId ?? ''}
                  onChange={(e) =>
                    handleSelectInventory(
                      e.target.value ? e.target.value : null,
                    )
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  disabled={!item.brand || !item.model}
                >
                  <option value="">
                    {item.brand && item.model
                      ? 'Seri numarası seç...'
                      : 'Önce marka ve model seçin'}
                  </option>
                  {serialOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {(row.serial_no || row.barcode || 'Seri yok') +
                        ' • ' +
                        row.brand +
                        ' ' +
                        row.model}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-6">
                <p className="mt-5 text-[10px] text-slate-400">
                  Seçilen seri numarası, hasta kaydından sonra bu
                  hastaya &quot;satıldı&quot; olarak işaretlenir.
                </p>
              </div>
            </div>

            {/* Liste fiyatı + not */}
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

              <div className="md:col-span-8">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Not
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
