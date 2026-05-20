// src/features/inventory/deviceCatalog/CatalogPriceListCard.tsx
// Searchable current catalog price list for Settings and stock matching.

import { FormEvent, useState } from 'react';
import { useCurrentProfile } from '../../auth/useCurrentProfile';
import {
  searchCatalogPricesForInventory,
  type InventoryCatalogSearchRow,
} from '../api.catalog';
import type { InventoryItemType } from '../types';

function formatMoney(value: number | null): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatItemType(value: InventoryItemType): string {
  return value === 'charger' ? 'Sarj aleti' : 'Isitme cihazi';
}

export function CatalogPriceListCard() {
  const { data: profile } = useCurrentProfile();
  const [query, setQuery] = useState('');
  const [itemType, setItemType] = useState<InventoryItemType | 'all'>('all');
  const [rows, setRows] = useState<InventoryCatalogSearchRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setRows(result);
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    } finally {
      setIsLoading(false);
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
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
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
                </tr>
              ))}
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
