// src/features/inventory/InventoryEditModal.tsx
// Modal for editing inventory product details without touching sale/patient binding.

import { useEffect, useState, type FormEvent } from 'react';
import type {
  EarSide,
  InventoryItemRow,
  InventoryItemType,
  UpdateInventoryItemForm,
} from './types';

type Props = {
  item: InventoryItemRow | null;
  open: boolean;
  isSubmitting: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSubmit: (values: UpdateInventoryItemForm) => void;
};

const ITEM_TYPES: { value: InventoryItemType; label: string }[] = [
  { value: 'hearing_aid', label: 'Isitme cihazi' },
  { value: 'charger', label: 'Sarj cihazi / aksesuar' },
];

const EAR_SIDES: { value: EarSide; label: string }[] = [
  { value: 'none', label: 'Yok / uygulanmaz' },
  { value: 'right', label: 'Sag' },
  { value: 'left', label: 'Sol' },
  { value: 'bilateral', label: 'Cift' },
];

function toMoneyInput(value: number | null): string {
  return value == null || !Number.isFinite(value) ? '' : String(value);
}

function createForm(item: InventoryItemRow): UpdateInventoryItemForm {
  return {
    id: item.id,
    brand: item.brand ?? '',
    model: item.model ?? '',
    itemType: item.item_type,
    earSide: item.ear_side ?? 'none',
    barcode: item.barcode ?? '',
    serialNo: item.serial_no ?? '',
    purchasePrice: toMoneyInput(item.purchase_price),
    listPrice: toMoneyInput(item.list_price),
  };
}

export function InventoryEditModal({
  item,
  open,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<UpdateInventoryItemForm | null>(null);

  useEffect(() => {
    if (open && item) {
      setForm(createForm(item));
    }
  }, [open, item]);

  if (!open || !item || !form) return null;

  function patch<K extends keyof UpdateInventoryItemForm>(
    key: K,
    value: UpdateInventoryItemForm[K],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    onSubmit(form);
  }

  const isSold = item.status === 'sold';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3">
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Stok urununu duzenle</h2>
          <p className="mt-1 text-xs text-slate-500">
            Bu form sadece urun bilgilerini degistirir. Hasta/satis baglantisi bu ekrandan degismez.
          </p>
          {isSold && (
            <p className="mt-2 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-700">
              Bu urun satilmis durumda; hasta baglantisi korunacak.
            </p>
          )}
        </div>

        <form className="space-y-3 p-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="font-medium text-slate-700">Marka</span>
              <input
                type="text"
                value={form.brand}
                onChange={(event) => patch('brand', event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-slate-700">Model</span>
              <input
                type="text"
                value={form.model}
                onChange={(event) => patch('model', event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="font-medium text-slate-700">Urun tipi</span>
              <select
                value={form.itemType}
                onChange={(event) => {
                  const itemType = event.target.value as InventoryItemType;
                  patch('itemType', itemType);
                  if (itemType === 'charger') patch('earSide', 'none');
                }}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {ITEM_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-slate-700">Kulak</span>
              <select
                value={form.earSide}
                disabled={form.itemType === 'charger'}
                onChange={(event) => patch('earSide', event.target.value as EarSide)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60"
              >
                {EAR_SIDES.map((side) => (
                  <option key={side.value} value={side.value}>
                    {side.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="font-medium text-slate-700">Barkod</span>
              <input
                type="text"
                value={form.barcode}
                onChange={(event) => patch('barcode', event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-slate-700">Seri no</span>
              <input
                type="text"
                value={form.serialNo}
                onChange={(event) => patch('serialNo', event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="font-medium text-slate-700">Gelis fiyati</span>
              <input
                type="text"
                value={form.purchasePrice}
                onChange={(event) => patch('purchasePrice', event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-slate-700">Liste fiyati</span>
              <input
                type="text"
                value={form.listPrice}
                onChange={(event) => patch('listPrice', event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
          </div>

          {errorMessage && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {errorMessage}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Vazgec
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
