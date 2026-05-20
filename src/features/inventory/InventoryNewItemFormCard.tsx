// src/features/inventory/InventoryNewItemFormCard.tsx
// Inline card to add a new inventory item (hearing aid or charger).
//
// v2.0:
// - Fiyat alanlarının açıklamasına şu davranış eklendi:
//   Eğer hem "Geliş Fiyatı" hem "Tavsiye Satış Fiyatı" boş bırakılırsa,
//   backend tarafında cihaz katalogundan (current_device_model_prices_public)
//   ilgili marka + model + ürün tipi için en güncel fiyatlar otomatik
//   alınmaya çalışılır. Katalogta da yoksa anlamlı bir hata gösterilir.
//
// v2.1:
// - Adds optional UI helper: "Katalogtan Doldur" button to prefill prices
//   without changing backend behavior (no feature loss).
// - The button only fills fields that are currently empty.

import { useMemo, useState, FormEvent } from 'react';
import { InlineCreateCard } from '../../components/layout/InlineCreateCard';
import { supabaseClient } from '../../utils/supabaseClient';
import {
  fetchCatalogPriceForInventory,
  searchCatalogPricesForInventory,
  type InventoryCatalogSearchRow,
} from './api.catalog';
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

function formatMoneyTr(v: number): string {
  // Keep it simple; UI is text-based and backend already parses flexible formats.
  // 25000 -> "25.000"
  const rounded = Math.round(v);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

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

  const [catalogHint, setCatalogHint] = useState<string | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [cachedOrgId, setCachedOrgId] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogResults, setCatalogResults] = useState<
    InventoryCatalogSearchRow[]
  >([]);

  const isCharger = formState.itemType === 'charger';

  const canUseCatalog = useMemo(() => {
    return (
      formState.brand.trim().length > 0 &&
      formState.model.trim().length > 0 &&
      !isSubmitting
    );
  }, [formState.brand, formState.model, isSubmitting]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setCatalogHint(null);
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

  const resolveOrgId = async (): Promise<string> => {
    if (cachedOrgId) return cachedOrgId;

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError) {
      console.error('Failed to get current user for catalog lookup:', userError);
      throw new Error('CATALOG_USER: ' + userError.message);
    }
    const user = userData.user;
    if (!user) {
      throw new Error('CATALOG_USER: Kullanıcı oturumu bulunamadı.');
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Failed to load profile for catalog lookup:', profileError);
      throw new Error('CATALOG_PROFILE: ' + profileError.message);
    }
    if (!profile?.org_id) {
      throw new Error('CATALOG_NO_ORG: Profilde org_id bulunamadı.');
    }

    const orgId = profile.org_id as string;
    setCachedOrgId(orgId);
    return orgId;
  };

  const handleFillFromCatalog = async () => {
    setCatalogHint(null);

    if (!canUseCatalog) {
      setCatalogHint('Katalogtan doldurmak için marka ve model gerekli.');
      return;
    }

    // Only useful when at least one price is empty
    const needsAnyPrice =
      formState.purchasePrice.trim().length === 0 || formState.listPrice.trim().length === 0;

    if (!needsAnyPrice) {
      setCatalogHint('Fiyat alanları zaten dolu.');
      return;
    }

    setIsCatalogLoading(true);
    try {
      const orgId = await resolveOrgId();

      const res = await fetchCatalogPriceForInventory({
        orgId,
        brand: formState.brand.trim(),
        model: formState.model.trim(),
        itemType: formState.itemType,
      });

      if (!res) {
        setCatalogHint(
          'Bu marka + model + ürün tipi için katalogta fiyat bulunamadı. İstersen manuel gir, kayıt sırasında backend yine deneyecek.',
        );
        return;
      }

      const hasAny = res.purchase_price != null || res.list_price != null;
      if (!hasAny) {
        setCatalogHint(
          'Katalogta kayıt bulundu ama fiyatlar boş görünüyor. Manuel girmen gerekebilir (backend de aynı durumda hata verebilir).',
        );
        return;
      }

      setFormState((s) => ({
        ...s,
        purchasePrice:
          s.purchasePrice.trim().length > 0
            ? s.purchasePrice
            : res.purchase_price != null
              ? formatMoneyTr(res.purchase_price)
              : '',
        listPrice:
          s.listPrice.trim().length > 0
            ? s.listPrice
            : res.list_price != null
              ? formatMoneyTr(res.list_price)
              : '',
      }));

      setCatalogHint('Katalog fiyatları dolduruldu (boş alanlara).');
    } catch (e) {
      setCatalogHint((e as Error).message);
    } finally {
      setIsCatalogLoading(false);
    }
  };

  const handleSearchCatalog = async () => {
    setCatalogHint(null);
    setIsCatalogLoading(true);
    setCatalogResults([]);

    try {
      const orgId = await resolveOrgId();
      const query =
        catalogSearch.trim() ||
        `${formState.brand.trim()} ${formState.model.trim()}`.trim();
      const rows = await searchCatalogPricesForInventory({
        orgId,
        query,
        itemType: formState.itemType,
        limit: 8,
      });
      setCatalogResults(rows);
      if (rows.length === 0) {
        setCatalogHint('Katalogta bu arama icin sonuc bulunamadi.');
      }
    } catch (e) {
      setCatalogHint((e as Error).message);
    } finally {
      setIsCatalogLoading(false);
    }
  };

  const handleSelectCatalog = (row: InventoryCatalogSearchRow) => {
    setFormState((s) => ({
      ...s,
      brand: row.brand,
      model: row.model,
      itemType: row.itemType,
      earSide: row.itemType === 'charger' ? 'none' : s.earSide,
      purchasePrice: row.purchase_price != null ? formatMoneyTr(row.purchase_price) : '',
      listPrice: row.list_price != null ? formatMoneyTr(row.list_price) : '',
    }));
    setCatalogHint('Katalog modeli secildi ve fiyatlar dolduruldu.');
    setCatalogResults([]);
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
          <label className="mb-1 block text-xs font-medium text-slate-600">Marka</label>
          <input
            type="text"
            required
            value={formState.brand}
            onChange={(e) => setFormState((s) => ({ ...s, brand: e.target.value }))}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Örn. Signia"
          />
        </div>

        {/* Model */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Model</label>
          <input
            type="text"
            required
            value={formState.model}
            onChange={(e) => setFormState((s) => ({ ...s, model: e.target.value }))}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Örn. Pure C&G 3AX"
          />
        </div>

        {/* Ürün tipi */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Ürün Tipi</label>
          <select
            value={formState.itemType}
            onChange={(e) => {
              const value = e.target.value as InventoryItemType;
              setFormState((s) => ({
                ...s,
                itemType: value,
                earSide:
                  value === 'charger' ? 'none' : s.earSide === 'none' ? 'bilateral' : s.earSide,
              }));
              setCatalogHint(null);
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
          <label className="mb-1 block text-xs font-medium text-slate-600">Kulak Tarafı</label>
          <select
            value={formState.earSide}
            onChange={(e) => setFormState((s) => ({ ...s, earSide: e.target.value as EarSide }))}
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
            Yeni stok için kulak yönü boş bırakılabilir. Satış sırasında hastaya göre sağ / sol
            atanacak. Şarj cihazı seçtiğinizde kulak tarafı otomatik olarak &quot;Yok&quot; olur.
          </p>
        </div>

        {/* Barkod + Seri no */}
        <div className="sm:col-span-2 lg:col-span-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Barkod</label>
            <input
              type="text"
              value={formState.barcode}
              onChange={(e) => setFormState((s) => ({ ...s, barcode: e.target.value }))}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Opsiyonel"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Seri No</label>
            <input
              type="text"
              value={formState.serialNo}
              onChange={(e) => setFormState((s) => ({ ...s, serialNo: e.target.value }))}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Opsiyonel"
            />
          </div>
        </div>

        <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Katalogdan model sec
              </label>
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Marka veya model ara"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleSearchCatalog}
                disabled={isCatalogLoading}
                className="rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCatalogLoading ? 'Araniyor...' : 'Katalog ara'}
              </button>
            </div>
          </div>
          {catalogResults.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white">
              {catalogResults.map((row) => (
                <button
                  type="button"
                  key={`${row.catalogModelId}-${row.valid_from}`}
                  onClick={() => handleSelectCatalog(row)}
                  className="block w-full border-b border-slate-100 px-2 py-2 text-left text-[11px] hover:bg-primary-50"
                >
                  <span className="font-semibold text-slate-900">
                    {row.brand} {row.model}
                  </span>
                  <span className="ml-2 text-slate-500">
                    {row.itemType} | Gelis:{' '}
                    {row.purchase_price != null
                      ? formatMoneyTr(row.purchase_price)
                      : '-'}{' '}
                    | Liste:{' '}
                    {row.list_price != null ? formatMoneyTr(row.list_price) : '-'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fiyatlar */}
        <div className="sm:col-span-2 lg:col-span-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Geliş Fiyatı</label>
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
            <div className="flex items-center justify-between gap-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Tavsiye Satış Fiyatı
              </label>
              <button
                type="button"
                onClick={handleFillFromCatalog}
                disabled={!canUseCatalog || isCatalogLoading}
                className="text-[11px] font-medium text-primary-700 hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
                title="Marka + model + ürün tipine göre katalogtan fiyatları getirir"
              >
                {isCatalogLoading ? 'Katalog...' : 'Katalogtan Doldur'}
              </button>
            </div>
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
              Eğer hem &quot;Geliş Fiyatı&quot; hem de &quot;Tavsiye Satış Fiyatı&quot; alanlarını
              boş bırakırsanız, kayıt sırasında cihaz katalogundaki en güncel purchase/list fiyatları
              otomatik olarak kullanılmaya çalışılır. Katalogta da yoksa sistem size hata mesajı
              gösterir.
            </p>
            {catalogHint && (
              <p className="mt-1 text-[11px] text-slate-600">{catalogHint}</p>
            )}
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
