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
//
// vNext (UI-first):
// - Adds deviceFlowType dropdown (default: rechargeable_device).
// - Shows optional charger selector for rechargeable_device.
// - Shows battery box for battery_device and battery_only.
// - battery_only hides device drafts UI (only battery box remains).

import { useMemo, useState } from 'react';
import type { NewPatientDeviceDraft } from '../../types';
import { useInventoryItems } from '../../../inventory/api';
import type { InventoryItemRow } from '../../../inventory/types';

type DeviceFlowType = 'rechargeable_device' | 'battery_device' | 'battery_only';

type BatteryPackType = 'box' | 'pack' | 'unit';

type BatteryLineDraft = {
  id: string;
  batteryType: '10' | '312' | '13' | '675';
  brand: string;
  qtyBox: number;
  qtyPack: number;
  qtyUnit: number;
};

type NewPatientDevicesSectionProps = {
  deviceFlowType: DeviceFlowType;
  onChangeDeviceFlowType: (value: DeviceFlowType) => void;

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

const DEVICE_FLOW_OPTIONS: Array<{ value: DeviceFlowType; label: string }> = [
  { value: 'rechargeable_device', label: 'Şarjlı cihaz' },
  { value: 'battery_device', label: 'Pilli cihaz' },
  { value: 'battery_only', label: 'Pil' },
];

const BATTERY_TYPES: Array<BatteryLineDraft['batteryType']> = ['10', '312', '13', '675'];

// Placeholder list for now.
// Next step: feed from catalogs (DB / views) and/or org settings.
const BATTERY_BRANDS_PLACEHOLDER = ['Duracell', 'Rayovac', 'Varta', 'Panasonic'];

function clampNonNegativeInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const n = Math.floor(value);
  return n < 0 ? 0 : n;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function NewPatientDevicesSection({
  deviceFlowType,
  onChangeDeviceFlowType,
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

  // item_type may or may not exist on InventoryItemRow typing depending on your local types.
  // We gate it defensively.
  const getItemType = (row: InventoryItemRow): string => {
    const anyRow = row as unknown as { item_type?: string };
    return anyRow.item_type ?? '';
  };

  const deviceInventory = useMemo(() => {
    if (!availableInventory.length) return [];
    // If item_type exists and is meaningful, exclude chargers from "device" picker.
    // Otherwise keep current behavior unchanged.
    const hasItemType = availableInventory.some((r) => !!getItemType(r));
    if (!hasItemType) return availableInventory;
    return availableInventory.filter((r) => getItemType(r) !== 'charger');
  }, [availableInventory]);

  const chargerInventory = useMemo(() => {
    if (!availableInventory.length) return [];
    const hasItemType = availableInventory.some((r) => !!getItemType(r));
    if (!hasItemType) return [];
    return availableInventory.filter((r) => getItemType(r) === 'charger');
  }, [availableInventory]);

  // ------------------------
  // Charger (optional) UI draft (not persisted yet)
  // ------------------------
  const [chargerBrand, setChargerBrand] = useState<string>('');
  const [chargerModel, setChargerModel] = useState<string>('');
  const [chargerInventoryId, setChargerInventoryId] = useState<string>('');

  const chargerBrandOptions = useMemo(() => {
    return Array.from(new Set(chargerInventory.map((r) => r.brand).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [chargerInventory]);

  const chargerModelOptions = useMemo(() => {
    return Array.from(
      new Set(
        chargerInventory
          .filter((r) => !chargerBrand || r.brand === chargerBrand)
          .map((r) => r.model)
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [chargerInventory, chargerBrand]);

  const chargerSerialOptions = useMemo(() => {
    return chargerInventory.filter((r) => {
      if (chargerBrand && r.brand !== chargerBrand) return false;
      if (chargerModel && r.model !== chargerModel) return false;
      return true;
    });
  }, [chargerInventory, chargerBrand, chargerModel]);

  // ------------------------
  // Battery box drafts (UI-first, not persisted yet)
  // ------------------------
  const [batteryLines, setBatteryLines] = useState<BatteryLineDraft[]>([
    {
      id: uid(),
      batteryType: '10',
      brand: '',
      qtyBox: 0,
      qtyPack: 0,
      qtyUnit: 0,
    },
  ]);

  const addBatteryLine = () => {
    setBatteryLines((prev) => [
      ...prev,
      { id: uid(), batteryType: '10', brand: '', qtyBox: 0, qtyPack: 0, qtyUnit: 0 },
    ]);
  };

  const removeBatteryLine = (id: string) => {
    setBatteryLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  };

  const patchBatteryLine = (id: string, patch: Partial<BatteryLineDraft>) => {
    setBatteryLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  // Unique marka listesi (device list)
  const brandOptions = useMemo(() => {
    return Array.from(new Set(deviceInventory.map((row) => row.brand).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [deviceInventory]);

  const selectedInventoryIds = items.map((d) => d.inventoryItemId).filter((id): id is string => !!id);

  const showDeviceDrafts = deviceFlowType !== 'battery_only';
  const showBatteryBox = deviceFlowType === 'battery_device' || deviceFlowType === 'battery_only';
  const showChargerBox = deviceFlowType === 'rechargeable_device';

  return (
    <div className="space-y-3">
      {/* Device flow type selector */}
      <div className="grid gap-2 md:grid-cols-12">
        <div className="md:col-span-4">
          <label className="mb-1 block text-[11px] font-medium text-slate-600">Cihaz Tipi</label>
          <select
            value={deviceFlowType}
            onChange={(e) => onChangeDeviceFlowType(e.target.value as DeviceFlowType)}
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {DEVICE_FLOW_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Seçime göre şarj aleti veya pil kutusu açılır. Bu adım kaydetmeyi engellemez.
          </p>
        </div>
      </div>

      {isLoading && <p className="text-[11px] text-slate-500">Stok listesi yükleniyor…</p>}

      {isError && (
        <p className="text-[11px] text-red-600">
          Stok listesi alınırken bir hata oluştu. Cihaz seçimi şu an yapılamıyor.
        </p>
      )}

      {/* Device drafts */}
      {showDeviceDrafts && (
        <>
          {items.map((item, index) => {
            // Seçilen markaya göre modeller
            const modelOptions = Array.from(
              new Set(
                deviceInventory
                  .filter((row) => !item.brand || row.brand === item.brand)
                  .map((row) => row.model)
                  .filter(Boolean),
              ),
            ).sort((a, b) => a.localeCompare(b));

            // Bu satır hariç seçilmiş inventory id'leri
            const otherSelectedIds = selectedInventoryIds.filter((id) => id !== item.inventoryItemId);

            // Seri numarası / stok seçenekleri
            const serialOptions = deviceInventory.filter((row) => {
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

              const inv = deviceInventory.find((row) => row.id === inventoryId);
              if (!inv) {
                onChangeRow(index, { inventoryItemId: inventoryId });
                return;
              }

              onChangeRow(index, {
                inventoryItemId: inventoryId,
                brand: inv.brand || item.brand,
                model: inv.model || item.model,
                listPrice: inv.list_price != null ? inv.list_price.toString() : item.listPrice,
              });
            };

            return (
              <div
                key={index}
                className="space-y-2 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700">Cihaz #{index + 1}</span>
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
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">Kulak</label>
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
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">Marka (stok)</label>
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
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">Model (stok)</label>
                    <select
                      value={item.model}
                      onChange={(e) => handleSelectModel(e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                      disabled={!item.brand}
                    >
                      <option value="">{item.brand ? 'Model seç...' : 'Önce marka seçin'}</option>
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
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">Seri No (stoktan bağla)</label>
                    <select
                      value={item.inventoryItemId ?? ''}
                      onChange={(e) => handleSelectInventory(e.target.value ? e.target.value : null)}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                      disabled={!item.brand || !item.model}
                    >
                      <option value="">
                        {item.brand && item.model ? 'Seri numarası seç...' : 'Önce marka ve model seçin'}
                      </option>
                      {serialOptions.map((row) => (
                        <option key={row.id} value={row.id}>
                          {(row.serial_no || row.barcode || 'Seri yok') + ' • ' + row.brand + ' ' + row.model}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-6">
                    <p className="mt-5 text-[10px] text-slate-400">
                      Seçilen seri numarası, hasta kaydından sonra bu hastaya &quot;satıldı&quot; olarak işaretlenir.
                    </p>
                  </div>
                </div>

                {/* Liste fiyatı + not */}
                <div className="grid gap-2 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">Liste Fiyatı (tek cihaz)</label>
                    <input
                      type="text"
                      value={item.listPrice}
                      onChange={(e) => onChangeRow(index, { listPrice: e.target.value })}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="Örn. 25.000"
                    />
                  </div>

                  <div className="md:col-span-8">
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">Not</label>
                    <input
                      type="text"
                      value={item.note}
                      onChange={(e) => onChangeRow(index, { note: e.target.value })}
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

      {/* Optional charger selector */}
      {showChargerBox && (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-700">Şarj Aleti (opsiyonel)</span>
          </div>

          <p className="text-[11px] text-slate-600">
            Şarjlı cihaz satışlarında şarj aleti seçmeniz önerilir. Seçmeseniz de kaydetmeye devam edebilirsiniz.
          </p>

          {chargerInventory.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              Not: Şarj aletlerini stoktan ayırmak için inventory_items.item_type = &quot;charger&quot; kullanılabilir.
              Şu an stokta &quot;charger&quot; tipinde item bulunamadı.
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-12">
              <div className="md:col-span-4">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Marka (charger)</label>
                <select
                  value={chargerBrand}
                  onChange={(e) => {
                    const v = e.target.value;
                    setChargerBrand(v);
                    setChargerModel('');
                    setChargerInventoryId('');
                  }}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Marka seç...</option>
                  {chargerBrandOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Model (charger)</label>
                <select
                  value={chargerModel}
                  onChange={(e) => {
                    const v = e.target.value;
                    setChargerModel(v);
                    setChargerInventoryId('');
                  }}
                  disabled={!chargerBrand}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">{chargerBrand ? 'Model seç...' : 'Önce marka seçin'}</option>
                  {chargerModelOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">Seri No (charger)</label>
                <select
                  value={chargerInventoryId}
                  onChange={(e) => setChargerInventoryId(e.target.value)}
                  disabled={!chargerBrand || !chargerModel}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {chargerBrand && chargerModel ? 'Seri numarası seç...' : 'Önce marka ve model seçin'}
                  </option>
                  {chargerSerialOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {(row.serial_no || row.barcode || 'Seri yok') + ' • ' + row.brand + ' ' + row.model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Battery box */}
      {showBatteryBox && (
        <div className="space-y-2 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-700">Pil</span>
            <button
              type="button"
              onClick={addBatteryLine}
              className="text-[11px] font-medium text-primary-700 hover:underline"
            >
              Pil satırı ekle
            </button>
          </div>

          <p className="text-[11px] text-slate-500">
            Miktar alanları aynı satırda birlikte girilebilir (örn: 3 kutu + 2 paket). 1 kutu = 10 paket, 1 paket = 6 adet.
          </p>

          <div className="space-y-2">
            {batteryLines.map((line) => (
              <div
                key={line.id}
                className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-2 md:grid-cols-12 md:items-end"
              >
                <div className="md:col-span-3">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Pil Tipi</label>
                  <select
                    value={line.batteryType}
                    onChange={(e) =>
                      patchBatteryLine(line.id, { batteryType: e.target.value as BatteryLineDraft['batteryType'] })
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    {BATTERY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Marka</label>
                  <select
                    value={line.brand}
                    onChange={(e) => patchBatteryLine(line.id, { brand: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">Marka seç...</option>
                    {BATTERY_BRANDS_PLACEHOLDER.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Kutu</label>
                  <input
                    type="number"
                    min={0}
                    value={line.qtyBox}
                    onChange={(e) => patchBatteryLine(line.id, { qtyBox: clampNonNegativeInt(Number(e.target.value)) })}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="0"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Paket</label>
                  <input
                    type="number"
                    min={0}
                    value={line.qtyPack}
                    onChange={(e) => patchBatteryLine(line.id, { qtyPack: clampNonNegativeInt(Number(e.target.value)) })}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="0"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Adet</label>
                  <input
                    type="number"
                    min={0}
                    value={line.qtyUnit}
                    onChange={(e) => patchBatteryLine(line.id, { qtyUnit: clampNonNegativeInt(Number(e.target.value)) })}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="0"
                  />
                </div>

                <div className="md:col-span-12 flex items-center justify-between">
                  <p className="text-[10px] text-slate-500">
                    Bu satır: {line.qtyBox} kutu, {line.qtyPack} paket, {line.qtyUnit} adet
                  </p>
                  <button
                    type="button"
                    onClick={() => removeBatteryLine(line.id)}
                    className="text-[11px] font-medium text-red-600 hover:underline"
                    disabled={batteryLines.length <= 1}
                  >
                    Satırı sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
