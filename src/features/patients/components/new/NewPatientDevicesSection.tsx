// src/features/patients/components/new/NewPatientDevicesSection.tsx
// Summary: Device draft section used in the "New Patient" form.
// v2.8:
// - Adds deviceFlowType selector (rechargeable/battery device/battery only).
// - Filters inventory items by item_type for device vs charger selection.
// - Adds charger selection for rechargeable flow.
// - Adds "Pil kutusu" list: addable lines, each line has box/pack/unit quantities in a single row.
//
// Patch v3.0 (trial → patient compatibility):
// - Brand options now also include any prefilled deviceDraft brand values (even if not in inventory).
// - Model options per row now also include that row's prefilled model (from trial), so the select
//   shows the correct value even when the model name doesn't exactly match inventory strings.

import type {
  BatteryLineDraft,
  NewPatientDeviceDraft,
  NewPatientDeviceFlowType,
} from '../../types';
import { useInventoryItems } from '../../../inventory/api';
import type { InventoryItemRow } from '../../../inventory/types';

type NewPatientDevicesSectionProps = {
  deviceFlowType: NewPatientDeviceFlowType;
  onChangeDeviceFlowType: (value: NewPatientDeviceFlowType) => void;

  chargerInventoryItemId: string | null;
  onChangeChargerInventoryItemId: (id: string | null) => void;

  batteryLines: BatteryLineDraft[];
  onChangeBatteryLines: (lines: BatteryLineDraft[]) => void;

  items: NewPatientDeviceDraft[];
  onAddRow: () => void;
  onChangeRow: (index: number, patch: Partial<NewPatientDeviceDraft>) => void;
  onRemoveRow: (index: number) => void;
};

const SIDE_OPTIONS = [
  { value: '', label: 'Seçilmedi' },
  { value: 'right', label: 'Sağ' },
  { value: 'left', label: 'Sol' },
  { value: 'bilateral', label: 'Çift' },
] as const;

const DEVICE_FLOW_OPTIONS: {
  value: NewPatientDeviceFlowType;
  label: string;
  hint: string;
}[] = [
  {
    value: 'rechargeable_device',
    label: 'Şarjlı cihaz',
    hint: 'Cihaz satırları + opsiyonel şarj aleti seçimi',
  },
  {
    value: 'battery_device',
    label: 'Pilli cihaz',
    hint: 'Cihaz satırları + pil kutusu',
  },
  {
    value: 'battery_only',
    label: 'Sadece pil',
    hint: 'Sadece pil kutusu (cihaz satırları kapalı)',
  },
];

function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

function toIntSafe(value: string): number {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

function createEmptyBatteryLine(): BatteryLineDraft {
  return {
    batteryType: '10',
    brand: '',
    quantity: { box: 0, pack: 0, unit: 0 },
  };
}

export function NewPatientDevicesSection({
  deviceFlowType,
  onChangeDeviceFlowType,
  chargerInventoryItemId,
  onChangeChargerInventoryItemId,
  batteryLines,
  onChangeBatteryLines,
  items,
  onAddRow,
  onChangeRow,
  onRemoveRow,
}: NewPatientDevicesSectionProps) {
  const { data: inventory, isLoading, isError } = useInventoryItems();

  // Stokta olan ve henüz bir hastaya bağlanmamış cihazlar.
  const availableInventory: InventoryItemRow[] = (inventory ?? []).filter(
    (row) => row.status === 'in_stock' && !row.sold_patient_id && !row.deleted_at,
  );

  // Separate pools:
  const availableDeviceInventory = availableInventory.filter(
    (row) => row.item_type === 'hearing_aid',
  );
  const availableChargerInventory = availableInventory.filter(
    (row) => row.item_type === 'charger',
  );

  // Unique marka listesi (devices only) + trial'dan gelen marka değerleri
  const brandOptions = Array.from(
    new Set(
      [
        ...availableDeviceInventory
          .map((row) => row.brand)
          .filter((b): b is string => !!b),
        ...items.map((i) => i.brand).filter((b): b is string => !!b),
      ].map((b) => b.trim()),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const selectedInventoryIds = items
    .map((d) => d.inventoryItemId)
    .filter((id): id is string => !!id);

  const showDeviceRows =
    deviceFlowType === 'rechargeable_device' ||
    deviceFlowType === 'battery_device';
  const showChargerSelect = deviceFlowType === 'rechargeable_device';
  const showBatteryBox =
    deviceFlowType === 'battery_device' || deviceFlowType === 'battery_only';

  const updateBatteryLine = (index: number, patch: Partial<BatteryLineDraft>) => {
    onChangeBatteryLines(
      (batteryLines ?? []).map((l, i) =>
        i === index ? { ...l, ...patch } : l,
      ),
    );
  };

  const updateBatteryQuantity = (
    index: number,
    key: 'box' | 'pack' | 'unit',
    rawValue: string,
  ) => {
    const n = clampInt(toIntSafe(rawValue), 0, 999);
    const line = (batteryLines ?? [])[index];
    if (!line) return;
    updateBatteryLine(index, {
      quantity: {
        ...line.quantity,
        [key]: n,
      },
    });
  };

  const addBatteryLine = () => {
    onChangeBatteryLines([...(batteryLines ?? []), createEmptyBatteryLine()]);
  };

  const removeBatteryLine = (index: number) => {
    const next = (batteryLines ?? []).filter((_, i) => i !== index);
    onChangeBatteryLines(next.length > 0 ? next : [createEmptyBatteryLine()]);
  };

  return (
    <div className="space-y-3">
      {/* Flow selector */}
      <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
        <label className="mb-1 block text-[11px] font-medium text-slate-600">
          Cihaz / Pil Tipi
        </label>
        <select
          value={deviceFlowType}
          onChange={(e) =>
            onChangeDeviceFlowType(
              e.target.value as NewPatientDeviceFlowType,
            )
          }
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {DEVICE_FLOW_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-500">
          {DEVICE_FLOW_OPTIONS.find((o) => o.value === deviceFlowType)?.hint}
        </p>
      </div>

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

      {/* Charger selection (rechargeable) */}
      {showChargerSelect && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <label className="mb-1 block text-[11px] font-medium text-slate-600">
            Şarj Aleti (opsiyonel)
          </label>
          <select
            value={chargerInventoryItemId ?? ''}
            onChange={(e) =>
              onChangeChargerInventoryItemId(
                e.target.value ? e.target.value : null,
              )
            }
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            disabled={availableChargerInventory.length === 0}
          >
            <option value="">
              {availableChargerInventory.length > 0
                ? 'Şarj aleti seç...'
                : 'Stokta şarj aleti yok'}
            </option>
            {availableChargerInventory.map((row) => (
              <option key={row.id} value={row.id}>
                {(row.serial_no || row.barcode || 'Seri yok') +
                  ' • ' +
                  row.brand +
                  ' ' +
                  row.model}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-400">
            Seçilirse, hasta kaydı sonrası bu satır da hastaya "satıldı" olarak
            işaretlenir.
          </p>
        </div>
      )}

      {/* Battery box */}
      {showBatteryBox && (
        <div className="space-y-2 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-700">Pil Kutusu</p>
              <p className="text-[11px] text-slate-500">
                Tek satırda çoklu miktar: kutu / paket / adet.
              </p>
            </div>
            <button
              type="button"
              onClick={addBatteryLine}
              className="inline-flex items-center rounded-md border border-dashed border-primary-300 px-3 py-1.5 text-xs font-medium text-primary-700 hover:border-primary-400 hover:bg-primary-50"
            >
              Satır ekle
            </button>
          </div>

          {(batteryLines ?? []).map((line, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 md:grid-cols-12"
            >
              <div className="md:col-span-3">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Pil Tipi
                </label>
                <select
                  value={line.batteryType}
                  onChange={(e) =>
                    updateBatteryLine(index, {
                      batteryType:
                        e.target.value as BatteryLineDraft['batteryType'],
                    })
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="10">10</option>
                  <option value="312">312</option>
                  <option value="13">13</option>
                  <option value="675">675</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Marka
                </label>
                <input
                  type="text"
                  value={line.brand}
                  onChange={(e) =>
                    updateBatteryLine(index, { brand: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Örn. Rayovac"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Kutu
                </label>
                <input
                  inputMode="numeric"
                  value={String(line.quantity.box ?? 0)}
                  onChange={(e) =>
                    updateBatteryQuantity(index, 'box', e.target.value)
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Paket
                </label>
                <input
                  inputMode="numeric"
                  value={String(line.quantity.pack ?? 0)}
                  onChange={(e) =>
                    updateBatteryQuantity(index, 'pack', e.target.value)
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Adet
                </label>
                <input
                  inputMode="numeric"
                  value={String(line.quantity.unit ?? 0)}
                  onChange={(e) =>
                    updateBatteryQuantity(index, 'unit', e.target.value)
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-12 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeBatteryLine(index)}
                  className="text-[11px] font-medium text-red-600 hover:underline"
                >
                  Satırı sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Device rows */}
      {showDeviceRows && (
        <>
          {items.map((item, index) => {
            // Inventory modelleri (şu satırın markasına göre filtrelenmiş)
            const inventoryModels = availableDeviceInventory
              .filter((row) => !item.brand || row.brand === item.brand)
              .map((row) => row.model)
              .filter((m): m is string => !!m)
              .map((m) => m.trim());

            // Bu satır için model seçenekleri:
            // - Stok modelleri
            // - Trial'dan gelen model değeri (stokta olmasa bile)
            const modelOptions = Array.from(
              new Set([
                ...inventoryModels,
                ...(item.model ? [item.model.trim()] : []),
              ]),
            ).sort((a, b) => a.localeCompare(b));

            // Bu satır hariç seçilmiş inventory id'leri
            const otherSelectedIds = selectedInventoryIds.filter(
              (id) => id !== item.inventoryItemId,
            );

            // Seri numarası / stok seçenekleri (devices only)
            const serialOptions = availableDeviceInventory.filter((row) => {
              if (otherSelectedIds.includes(row.id)) return false;
              if (item.brand && row.brand !== item.brand) return false;
              if (item.model && row.model !== item.model) return false;
              return true;
            });

            const handleSelectBrand = (brand: string) => {
              const trimmed = brand.trim();
              onChangeRow(index, {
                brand: trimmed,
                // Marka değişince model ve inventory seçimleri resetlenir.
                model: '',
                inventoryItemId: null,
                listPrice: '',
              });
            };

            const handleSelectModel = (model: string) => {
              const trimmed = model.trim();
              onChangeRow(index, {
                model: trimmed,
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

              const inv = availableDeviceInventory.find(
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
                      Seçilen seri numarası, hasta kaydından sonra bu hastaya
                      &quot;satıldı&quot; olarak işaretlenir.
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
        </>
      )}
    </div>
  );
}
