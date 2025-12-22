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
//
// Patch v3.2 (aggressive normalize + manual guidance):
// - Brand/model equality checks for serial-no dropdown now use a normalized comparison
//   (trim + whitespace collapse + TR-upper) to match trial vs inventory strings.
// - Brand/model dropdown options are deduplicated by normalized key, preferring inventory labels.
// - If a prefilled trial brand+model cannot be matched to any inventory row (even after normalization),
//   a warning box is shown above the device rows listing:
//   * which device row (Cihaz #),
//   * which brand/model came from trial,
//   * suggested candidate models from stock (same normalized brand).
//   The user is directed to manually select the correct brand/model from stock.
//
// Patch v3.3 (hyphen-insensitive matching):
// - normalizeName now treats '-', '–', '—', '_', '/' and '.' gibi işaretleri boşluk gibi ele alır.
//   Böylece REACH R-Li 80 ile REACH R Li 80 aynı model kabul edilir.
//
// Patch v3.4 (list price hidden from UI):
// - Hides manual "Liste Fiyatı" input in device rows. listPrice remains internal-only.

import { useEffect } from 'react';
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

/**
 * Normalizes brand/model names for comparison:
 * - replaces common separators (- _ / . and long dashes) with spaces
 * - trims
 * - collapses internal whitespace
 * - uppercases (TR locale)
 *
 * Böylece "REACH R-Li 80" ve "REACH R Li 80" aynı kabul edilir.
 */
function normalizeName(value: string | null | undefined): string {
  if (!value) return '';
  const replaced = value
    // tire, uzun tire, alt tire, slash ve noktayı boşluk gibi ele al
    .replace(/[-–—_/.,]+/g, ' ');
  const trimmed = replaced.trim();
  if (!trimmed) return '';
  const collapsed = trimmed.replace(/\s+/g, ' ');
  return collapsed.toLocaleUpperCase('tr-TR');
}

type UnmatchedDeviceInfo = {
  index: number;
  brand: string;
  model: string;
  candidateModels: string[];
};

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

  // Trial'dan gelen deviceDraft brand/model değerlerini, stoktaki
  // brand/model stringleriyle normalize ederek eşler. Eğer normalize
  // edilince birebir eşleşen stok etiketi varsa, draft'i o etiketle güncelleriz.
  useEffect(() => {
    if (!availableDeviceInventory.length || !items.length) return;

    items.forEach((item, index) => {
      const normalizedBrand = normalizeName(item.brand);
      const normalizedModel = normalizeName(item.model);

      // Marka eşleme (case/whitespace/punctuation insensitive)
      if (normalizedBrand) {
        const brandCandidate = availableDeviceInventory.find(
          (row) => normalizeName(row.brand) === normalizedBrand,
        );

        if (brandCandidate && brandCandidate.brand !== item.brand) {
          onChangeRow(index, { brand: brandCandidate.brand });
        }
      }

      // Model eşleme (marka da varsa aynı marka içinde aramaya çalış)
      if (normalizedModel) {
        const modelCandidate = availableDeviceInventory.find((row) => {
          const rowBrandNorm = normalizeName(row.brand);
          const rowModelNorm = normalizeName(row.model);
          const brandMatches =
            !normalizedBrand || rowBrandNorm === normalizedBrand;
          return brandMatches && rowModelNorm === normalizedModel;
        });

        if (modelCandidate && modelCandidate.model !== item.model) {
          onChangeRow(index, { model: modelCandidate.model });
        }
      }
    });
  }, [availableDeviceInventory, items, onChangeRow]);

  // Aggressive dedupe: brandOptions tek bir label listesi, normalize key'e göre.
  const brandMap = new Map<string, string>();
  for (const row of availableDeviceInventory) {
    const key = normalizeName(row.brand);
    if (!key) continue;
    if (!brandMap.has(key)) {
      brandMap.set(key, (row.brand ?? '').trim());
    }
  }
  for (const item of items) {
    const key = normalizeName(item.brand);
    if (!key) continue;
    if (!brandMap.has(key)) {
      brandMap.set(key, (item.brand ?? '').trim());
    }
  }
  const brandOptions = Array.from(brandMap.values()).sort((a, b) =>
    a.localeCompare(b),
  );

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
      (batteryLines ?? []).map((l, i) => (i === index ? { ...l, ...patch } : l)),
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

  // Trial'dan gelen ama stokta normalize edilmiş brand+model kombinasyonunu
  // bulamadığımız satırlar için uyarı listesi hazırlayalım.
  const unmatchedDevices: UnmatchedDeviceInfo[] = items
    .map<UnmatchedDeviceInfo | null>((item, index) => {
      const brand = item.brand?.trim() ?? '';
      const model = item.model?.trim() ?? '';

      if (!brand || !model) return null;

      const nb = normalizeName(brand);
      const nm = normalizeName(model);
      if (!nb || !nm) return null;

      const hasExactCombo = availableDeviceInventory.some((row) => {
        return (
          normalizeName(row.brand) === nb && normalizeName(row.model) === nm
        );
      });

      if (hasExactCombo) return null;

      const sameBrandRows = availableDeviceInventory.filter(
        (row) => normalizeName(row.brand) === nb,
      );
      const candidateModels = Array.from(
        new Set(
          sameBrandRows
            .map((row) => row.model)
            .filter((m): m is string => !!m)
            .map((m) => m.trim()),
        ),
      ).sort((a, b) => a.localeCompare(b));

      return {
        index,
        brand,
        model,
        candidateModels,
      };
    })
    .filter((x): x is UnmatchedDeviceInfo => x !== null);

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
            onChangeDeviceFlowType(e.target.value as NewPatientDeviceFlowType)
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

      {/* Device rows uyarı mesajı (normalize edilemeyen trial modelleri) */}
      {showDeviceRows && unmatchedDevices.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          <p className="font-medium">
            Uyarı: Bazı cihaz satırları stoktaki marka/model ile otomatik
            eşleşmedi.
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {unmatchedDevices.map((u) => (
              <li key={u.index}>
                Cihaz #{u.index + 1}:{' '}
                <span className="font-semibold">
                  Marka &quot;{u.brand || '-'}&quot;, Model &quot;
                  {u.model || '-'}&quot;.
                </span>{' '}
                {u.candidateModels.length > 0 ? (
                  <>
                    Stoktaki olası modeller:{' '}
                    <span className="font-semibold">
                      {u.candidateModels.join(', ')}
                    </span>
                    . Bu satırda lütfen marka/model alanlarını stoktan manuel
                    olarak seç.
                  </>
                ) : (
                  <>
                    Bu kombinasyon için stokta eşleşen bir marka/model
                    bulunamadı. Bu satırda stoktan uygun marka ve modeli elle
                    seç.
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Device rows */}
      {showDeviceRows && (
        <>
          {items.map((item, index) => {
            // Inventory modelleri (şu satırın markasına göre filtrelenmiş)
            const inventoryModelsRaw = availableDeviceInventory
              .filter((row) => {
                if (!item.brand) return true;
                return (
                  normalizeName(row.brand) === normalizeName(item.brand)
                );
              })
              .map((row) => row.model)
              .filter((m): m is string => !!m);

            // Model seçeneklerini normalize key'e göre dedupe et.
            const modelMap = new Map<string, string>();
            for (const m of inventoryModelsRaw) {
              const key = normalizeName(m);
              if (!key) continue;
              if (!modelMap.has(key)) {
                modelMap.set(key, m.trim());
              }
            }
            if (item.model) {
              const key = normalizeName(item.model);
              if (key && !modelMap.has(key)) {
                modelMap.set(key, item.model.trim());
              }
            }
            const modelOptions = Array.from(modelMap.values()).sort((a, b) =>
              a.localeCompare(b),
            );

            // Bu satır hariç seçilmiş inventory id'leri
            const otherSelectedIds = selectedInventoryIds.filter(
              (id) => id !== item.inventoryItemId,
            );

            // Seri numarası / stok seçenekleri (devices only) – normalize eşitliğe göre filtreler.
            const serialOptions = availableDeviceInventory.filter((row) => {
              if (otherSelectedIds.includes(row.id)) return false;
              if (
                item.brand &&
                normalizeName(row.brand) !== normalizeName(item.brand)
              ) {
                return false;
              }
              if (
                item.model &&
                normalizeName(row.model) !== normalizeName(item.model)
              ) {
                return false;
              }
              return true;
            });

            const handleSelectBrand = (brand: string) => {
              const trimmed = brand.trim();
              onChangeRow(index, {
                brand: trimmed,
                model: '',
                inventoryItemId: null,
                listPrice: '',
              });
            };

            const handleSelectModel = (model: string) => {
              const trimmed = model.trim();
              onChangeRow(index, {
                model: trimmed,
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

                {/* Not (liste fiyatı alanı gizlendi) */}
                <div className="grid gap-2 md:grid-cols-12">
                  <div className="md:col-span-12">
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

      {/* Charger selection (rechargeable) – en sonda da dursa olur, UX tercihi:
          İstersen üstteki versiyona geri alabiliriz. */}
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
            Seçilirse, hasta kaydı sonrası bu satır da hastaya &quot;satıldı&quot;
            olarak işaretlenir.
          </p>
        </div>
      )}
    </div>
  );
}
