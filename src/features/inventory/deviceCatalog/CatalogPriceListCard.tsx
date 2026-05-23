// src/features/inventory/deviceCatalog/CatalogPriceListCard.tsx
// Searchable current catalog price list for Settings and stock matching.

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useCurrentProfile } from '../../auth/useCurrentProfile';
import {
  CATALOG_ITEM_TYPES,
  fetchInventoryStockThresholds,
  saveInventoryStockThreshold,
  searchCatalogPricesForInventory,
  type InventoryCatalogSearchRow,
} from '../api.catalog';
import type {
  CatalogItemType,
  InventoryItemType,
  InventoryStockThresholdRow,
} from '../types';

function formatMoney(value: number | null): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatItemType(value: CatalogItemType): string {
  if (value === 'charger') return 'Sarj aleti';
  if (value === 'receiver') return 'Receiver';
  if (value === 'battery') return 'Pil';
  return 'Isitme cihazi';
}

function parseThresholdInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('Minimum stok 0 veya daha buyuk tam sayi olmalidir.');
  }
  return parsed;
}

export function CatalogPriceListCard() {
  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.role === 'admin';
  const [query, setQuery] = useState('');
  const [itemType, setItemType] = useState<InventoryItemType | 'all'>('all');
  const [rows, setRows] = useState<InventoryCatalogSearchRow[]>([]);
  const [thresholds, setThresholds] = useState<InventoryStockThresholdRow[]>(
    [],
  );
  const [generalInputs, setGeneralInputs] = useState<Record<string, string>>({});
  const [modelInputs, setModelInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const thresholdByModel = useMemo(() => {
    const map = new Map<string, InventoryStockThresholdRow>();
    thresholds.forEach((threshold) => {
      if (threshold.catalog_model_id) {
        map.set(threshold.catalog_model_id, threshold);
      }
    });
    return map;
  }, [thresholds]);

  const thresholdByType = useMemo(() => {
    const map = new Map<string, InventoryStockThresholdRow>();
    thresholds.forEach((threshold) => {
      if (!threshold.catalog_model_id && threshold.item_type) {
        map.set(threshold.item_type, threshold);
      }
    });
    return map;
  }, [thresholds]);

  async function loadThresholds(orgId: string) {
    const result = await fetchInventoryStockThresholds(orgId);
    setThresholds(result);
    setGeneralInputs((prev) => {
      const next = { ...prev };
      CATALOG_ITEM_TYPES.forEach((type) => {
        if (next[type] !== undefined) return;
        const threshold = result.find(
          (row) => !row.catalog_model_id && row.item_type === type,
        );
        next[type] = threshold ? String(threshold.minimum_stock) : '';
      });
      return next;
    });
  }

  useEffect(() => {
    if (!profile?.org_id) return;
    void loadThresholds(profile.org_id).catch((err) => {
      setError((err as Error).message);
    });
  }, [profile?.org_id]);

  async function handleSearch(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!profile?.org_id) {
        throw new Error('Profil org_id bulunamadi.');
      }

      const result = await searchCatalogPricesForInventory({
        orgId: profile.org_id,
        query,
        itemType,
        limit: 50,
      });
      await loadThresholds(profile.org_id);
      setRows(result);
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveGeneralThreshold(type: CatalogItemType) {
    if (!profile?.org_id || !isAdmin) return;
    setError(null);
    setSavingKey(`general:${type}`);
    try {
      await saveInventoryStockThreshold({
        orgId: profile.org_id,
        itemType: type,
        catalogModelId: null,
        minimumStock: parseThresholdInput(generalInputs[type] ?? ''),
      });
      await loadThresholds(profile.org_id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSaveModelThreshold(row: InventoryCatalogSearchRow) {
    if (!profile?.org_id || !isAdmin || !row.catalogModelId) return;
    const key = row.catalogModelId;
    const current = modelInputs[key] ?? '';
    setError(null);
    setSavingKey(`model:${key}`);
    try {
      await saveInventoryStockThreshold({
        orgId: profile.org_id,
        itemType: null,
        catalogModelId: key,
        minimumStock: parseThresholdInput(current),
      });
      await loadThresholds(profile.org_id);
      setModelInputs((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Fiyat Katalog Listesi
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Stok eklerken ve CSV importta fiyatlar bu katalogdan eslesir.
            Modeli burada arayip katalogdaki yazimi kontrol edebilirsiniz.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSearch}
        className="grid gap-2 text-xs md:grid-cols-[minmax(0,1fr)_180px_auto]"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          placeholder="Marka veya model ara"
        />
        <select
          value={itemType}
          onChange={(e) =>
            setItemType(e.target.value as InventoryItemType | 'all')
          }
          className="rounded-md border border-slate-300 px-3 py-2 text-xs"
        >
          <option value="all">Tum urun tipleri</option>
          <option value="hearing_aid">Isitme cihazi</option>
          <option value="charger">Sarj aleti</option>
        </select>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
        >
          {isLoading ? 'Araniyor...' : 'Ara'}
        </button>
      </form>

      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-slate-900">
              Genel stok eşikleri
            </h4>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Boş bırakılan tipler pano uyarısı üretmez. Model özel eşiği varsa
              genel eşiğin yerine geçer.
            </p>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          {CATALOG_ITEM_TYPES.map((type) => {
            const saving = savingKey === `general:${type}`;
            return (
              <div key={type} className="rounded-md bg-white p-2">
                <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                  {formatItemType(type)}
                </label>
                <div className="flex gap-1">
                  <input
                    value={
                      generalInputs[type] ??
                      String(thresholdByType.get(type)?.minimum_stock ?? '')
                    }
                    onChange={(e) =>
                      setGeneralInputs((prev) => ({
                        ...prev,
                        [type]: e.target.value,
                      }))
                    }
                    disabled={!isAdmin}
                    className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-100"
                    placeholder="Boş"
                  />
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => void handleSaveGeneralThreshold(type)}
                      disabled={saving}
                      className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-60"
                    >
                      {saving ? '...' : 'Kaydet'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-md bg-red-50 p-2 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-3 max-h-80 overflow-auto rounded-md border border-slate-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-2 py-1 font-semibold">Marka / model</th>
                <th className="px-2 py-1 font-semibold">Tip</th>
                <th className="px-2 py-1 font-semibold">Gelis</th>
                <th className="px-2 py-1 font-semibold">Liste</th>
                <th className="px-2 py-1 font-semibold">Gecerli tarih</th>
                <th className="px-2 py-1 font-semibold">Model min stok</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const modelId = row.catalogModelId ?? '';
                const threshold = modelId
                  ? thresholdByModel.get(modelId)
                  : undefined;
                const inputValue =
                  modelInputs[modelId] ??
                  (threshold ? String(threshold.minimum_stock) : '');
                const saving = savingKey === `model:${modelId}`;

                return (
                  <tr
                    key={`${row.catalogModelId}-${row.valid_from}`}
                    className="border-t border-slate-100"
                  >
                    <td className="px-2 py-1">
                      <div className="font-medium text-slate-900">
                        {row.brand}
                      </div>
                      <div className="text-[10px] text-slate-600">
                        {row.model}
                      </div>
                    </td>
                    <td className="px-2 py-1">{formatItemType(row.itemType)}</td>
                    <td className="px-2 py-1">{formatMoney(row.purchase_price)}</td>
                    <td className="px-2 py-1">{formatMoney(row.list_price)}</td>
                    <td className="px-2 py-1">{row.valid_from ?? '-'}</td>
                    <td className="px-2 py-1">
                      <div className="flex min-w-[140px] gap-1">
                        <input
                          value={inputValue}
                          onChange={(e) =>
                            setModelInputs((prev) => ({
                              ...prev,
                              [modelId]: e.target.value,
                            }))
                          }
                          disabled={!isAdmin || !modelId}
                          className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] disabled:bg-slate-100"
                          placeholder="Genel"
                        />
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => void handleSaveModelThreshold(row)}
                            disabled={saving || !modelId}
                            className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-60"
                          >
                            {saving ? '...' : 'Kaydet'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <p className="mt-3 text-[11px] text-slate-500">
          Arama yaparak katalogdaki guncel fiyatlari gorebilirsiniz.
        </p>
      )}
    </section>
  );
}
