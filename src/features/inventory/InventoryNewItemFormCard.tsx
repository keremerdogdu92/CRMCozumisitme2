// src/features/inventory/InventoryNewItemFormCard.tsx
// Inline card to add a new inventory item (hearing aid or charger).
//
// v2.0:
// - Fiyat alanlarının açıklamasına şu davranış eklendi:
//   Eğer hem "Geliş Fiyatı" hem "Tavsiye Satış Fiyatı" boş bırakılırsa,
//   backend tarafında cihaz katalogundan (current_device_model_prices_public)
//   ilgili marka + model + ürün tipi için en güncel fiyatlar otomatik
//   alınmaya çalışılır. Katalogta da yoksa anlamlı bir hata gösterilir.

import { useState, FormEvent } from 'react';
import { InlineCreateCard } from '../../components/layout/InlineCreateCard';
import type { EarSide, InventoryItemType, NewInventoryItemForm } from './types';

type Props = {
  open: boolean;
  onToggle: () => void;
  onSubmit: (values: NewInventoryItemForm) => void;
  isSubmitting: boolean;
  errorMessage?: string;
};

const ITEM_TYPE_OPTIONS: { value: InventoryItemType; label: string }[] = [
  { value: 'hearing_aid', label: 'İşitme Cihazı' },
  { value: 'charger', label: 'Şarj Cihazı / Aksesuar' },
];

const EAR_SIDE_OPTIONS: { value: EarSide; label: string }[] = [
  { value: 'right', label: 'Sağ' },
  { value: 'left', label: 'Sol' },
  { value: 'bilateral', label: 'Çift (Sağ+Sol)' },
  { value: 'none', label: 'Yok / Henüz Atanmadı' },
];

export function InventoryNewItemFormCard({
  open,
  onToggle,
  onSubmit,
  isSubmitting,
  errorMessage,
}: Props) {
  const [formState, setFormState] = useState<NewInventoryItemForm>({
    brand: '',
    model: '',
    itemType: 'hearing_aid',
    earSide: 'none', // yeni stokta kulak yönü zorunlu değil
    barcode: '',
    serialNo: '',
    purchasePrice: '',
    listPrice: '',
  });

  const isCharger = formState.itemType === 'charger';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(formState);

    setFormState({
      brand: '',
      model: '',
      itemType: 'hearing_aid',
      earSide: 'none',
      barcode: '',
      serialNo: '',
      purchasePrice: '',
      listPrice: '',
    });
  };

  return (
    <InlineCreateCard
      title="Yeni Cihaz / Aksesuar Ekle"
      description="Marka, model ve stok bilgileri ile yeni bir ürün ekleyin."
      open={open}
      onToggle={onToggle}
      errorMessage={errorMessage}
    >
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:items-start"
        onSubmit={handleSubmit}
      >
        {/* Marka */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Marka
          </label>
          <input
            type="text"
            required
            value={formState.brand}
            onChange={(e) =>
              setFormState((s) => ({ ...s, brand: e.target.value }))
            }
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Örn. Signia"
          />
        </div>

        {/* Model */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Model
          </label>
          <input
            type="text"
            required
            value={formState.model}
            onChange={(e) =>
              setFormState((s) => ({ ...s, model: e.target.value }))
            }
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Örn. Pure C&G 3AX"
          />
        </div>

        {/* Ürün tipi */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Ürün Tipi
          </label>
          <select
            value={formState.itemType}
            onChange={(e) => {
              const value = e.target.value as InventoryItemType;
              setFormState((s) => ({
                ...s,
                itemType: value,
                earSide:
                  value === 'charger'
                    ? 'none'
                    : s.earSide === 'none'
                    ? 'bilateral'
                    : s.earSide,
              }));
            }}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {ITEM_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Kulak tarafı */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Kulak Tarafı
          </label>
          <select
            value={formState.earSide}
            onChange={(e) =>
              setFormState((s) => ({
                ...s,
                earSide: e.target.value as EarSide,
              }))
            }
            disabled={isCharger}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {EAR_SIDE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Yeni stok için kulak yönü boş bırakılabilir. Satış sırasında hastaya
            göre sağ / sol atanacak. Şarj cihazı seçtiğinizde kulak tarafı
            otomatik olarak &quot;Yok&quot; olur.
          </p>
        </div>

        {/* Barkod + Seri no */}
        <div className="sm:col-span-2 lg:col-span-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Barkod
            </label>
            <input
              type="text"
              value={formState.barcode}
              onChange={(e) =>
                setFormState((s) => ({ ...s, barcode: e.target.value }))
              }
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Opsiyonel"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Seri No
            </label>
            <input
              type="text"
              value={formState.serialNo}
              onChange={(e) =>
                setFormState((s) => ({ ...s, serialNo: e.target.value }))
              }
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Opsiyonel"
            />
          </div>
        </div>

        {/* Fiyatlar */}
        <div className="sm:col-span-2 lg:col-span-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Geliş Fiyatı
            </label>
            <input
              type="text"
              value={formState.purchasePrice}
              onChange={(e) =>
                setFormState((s) => ({
                  ...s,
                  purchasePrice: e.target.value,
                }))
              }
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Örn. 25.000"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Tavsiye Satış Fiyatı
            </label>
            <input
              type="text"
              value={formState.listPrice}
              onChange={(e) =>
                setFormState((s) => ({
                  ...s,
                  listPrice: e.target.value,
                }))
              }
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Örn. 40.000"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Eğer hem &quot;Geliş Fiyatı&quot; hem de &quot;Tavsiye Satış
              Fiyatı&quot; alanlarını boş bırakırsanız, kayıt sırasında cihaz
              katalogundaki en güncel purchase/list fiyatları otomatik olarak
              kullanılmaya çalışılır. Katalogta da yoksa sistem size hata
              mesajı gösterir.
            </p>
          </div>
        </div>

        <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </InlineCreateCard>
  );
}
