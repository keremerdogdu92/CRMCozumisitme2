// src/features/patients/import/InventoryImportRowFixModal.tsx
// Modal for fixing one failed inventory import row and inserting it atomically.

import { FormEvent, useEffect, useState } from 'react';
import type {
  InventoryItemType,
  InventoryStatus,
} from '../../inventory/types';
import { parsePriceOrNull } from '../../inventory/inventoryPriceUtils';
import {
  findActiveInventoryItemBySerial,
  resolveInventoryImportRow,
  type InventoryDuplicateLookupRow,
} from '../../inventory/api.importFix';
import {
  searchCatalogPricesForInventory,
  type InventoryCatalogSearchRow,
} from '../../inventory/api.catalog';
import { useCurrentProfile } from '../../auth/useCurrentProfile';
import type { InventoryImportRow } from './types';

type Props = {
  row: InventoryImportRow;
  onClose: () => void;
  onFixed: () => void;
};

function formatMoneyTr(v: number | null): string {
  if (v == null) return '';
  const rounded = Math.round(v);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function normalizeInitialItemType(raw: string | null): InventoryItemType {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'charger' || value === 'aksesuar' || value === 'sarj') {
    return 'charger';
  }
  return 'hearing_aid';
}

function normalizeInitialStatus(raw: string | null): InventoryStatus {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'sold' || value === 'repair') return value;
  return 'in_stock';
}

export function InventoryImportRowFixModal({ row, onClose, onFixed }: Props) {
  const { data: profile } = useCurrentProfile();

  const [brand, setBrand] = useState(row.raw_brand ?? '');
  const [model, setModel] = useState(row.raw_model ?? '');
  const [catalogModelId, setCatalogModelId] = useState<string | null>(null);
  const [itemType, setItemType] = useState<InventoryItemType>(
    normalizeInitialItemType(row.raw_item_type),
  );
  const [serialNo, setSerialNo] = useState(row.raw_serial_no ?? '');
  const [barcode, setBarcode] = useState(row.raw_barcode ?? '');
  const [status, setStatus] = useState<InventoryStatus>(
    normalizeInitialStatus(row.raw_status),
  );
  const [purchasePrice, setPurchasePrice] = useState(
    row.raw_purchase_price ?? '',
  );
  const [listPrice, setListPrice] = useState(row.raw_list_price ?? '');
  const [purchaseDate, setPurchaseDate] = useState(
    row.raw_purchase_date ?? '',
  );
  const [notes, setNotes] = useState(row.raw_notes ?? '');
  const [resolutionNote, setResolutionNote] = useState('');

  const [catalogQuery, setCatalogQuery] = useState(
    `${row.raw_brand ?? ''} ${row.raw_model ?? ''}`.trim(),
  );
  const [catalogRows, setCatalogRows] = useState<InventoryCatalogSearchRow[]>(
    [],
  );
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [duplicateRow, setDuplicateRow] =
    useState<InventoryDuplicateLookupRow | null>(null);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const initialSerialNo = row.raw_serial_no ?? '';

    async function checkInitialDuplicate() {
      if (!initialSerialNo.trim()) return;
      setDuplicateLoading(true);
      try {
        const existing = await findActiveInventoryItemBySerial(initialSerialNo);
        if (isMounted) setDuplicateRow(existing);
      } catch {
        if (isMounted) setDuplicateRow(null);
      } finally {
        if (isMounted) setDuplicateLoading(false);
      }
    }

    void checkInitialDuplicate();
    return () => {
      isMounted = false;
    };
  }, [row.raw_serial_no]);

  async function handleDuplicateCheck() {
    setSubmitError(null);
    setDuplicateLoading(true);
    try {
      setDuplicateRow(await findActiveInventoryItemBySerial(serialNo));
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setDuplicateLoading(false);
    }
  }

  async function handleCatalogSearch() {
    setSubmitError(null);
    setCatalogLoading(true);
    setCatalogRows([]);

    try {
      if (!profile?.org_id) {
        throw new Error('Profil org_id bulunamadi.');
      }

      const rows = await searchCatalogPricesForInventory({
        orgId: profile.org_id,
        query: catalogQuery,
        itemType,
        limit: 12,
      });
      setCatalogRows(rows);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setCatalogLoading(false);
    }
  }

  function handleSelectCatalog(row: InventoryCatalogSearchRow) {
    setBrand(row.brand);
    setModel(row.model);
    setItemType(row.itemType as InventoryItemType);
    setCatalogModelId(row.catalogModelId);
    setPurchasePrice(formatMoneyTr(row.purchase_price));
    setListPrice(formatMoneyTr(row.list_price));
    setResolutionNote(
      `Katalog eslendi: ${row.brand} ${row.model} (${row.itemType})`,
    );
  }

  function parseOptionalPrice(raw: string, fieldName: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return parsePriceOrNull(trimmed);
    } catch (err) {
      throw new Error(`${fieldName}: ${(err as Error).message}`);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!brand.trim()) {
      setSubmitError('Marka zorunludur.');
      return;
    }
    if (!model.trim()) {
      setSubmitError('Model zorunludur.');
      return;
    }
    if (!serialNo.trim()) {
      setSubmitError('Seri no zorunludur.');
      return;
    }

    let parsedPurchasePrice: number | null;
    let parsedListPrice: number | null;
    try {
      parsedPurchasePrice = parseOptionalPrice(purchasePrice, 'Gelis fiyati');
      parsedListPrice = parseOptionalPrice(listPrice, 'Liste fiyati');
    } catch (err) {
      setSubmitError((err as Error).message);
      return;
    }

    if (parsedPurchasePrice == null && parsedListPrice == null) {
      setSubmitError(
        'En az bir fiyat gerekli. Katalogdan esleyin veya manuel fiyat girin.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await resolveInventoryImportRow({
        rowId: row.id,
        brand: brand.trim(),
        model: model.trim(),
        itemType,
        catalogModelId,
        barcode: barcode.trim() || null,
        serialNo: serialNo.trim(),
        status,
        purchasePrice: parsedPurchasePrice,
        listPrice: parsedListPrice,
        purchaseDate: purchaseDate.trim() || null,
        notes: notes.trim() || null,
        resolutionNote: resolutionNote.trim() || null,
      });

      onFixed();
      onClose();
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-2">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Stok import satirini duzelt (row #{row.row_index})
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Bu satiri duzeltip tek urun olarak stoklara ekler. Diger import
              satirlari yeniden calistirilmaz.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            Kapat
          </button>
        </div>

        <div className="mt-3 rounded-md bg-red-50 p-2 text-[11px] text-red-800">
          {row.validation_error ?? 'Hata detayi yok.'}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-[11px]">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-800">
                Marka
              </label>
              <input
                value={brand}
                onChange={(e) => {
                  setBrand(e.target.value);
                  setCatalogModelId(null);
                }}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-800">
                Model
              </label>
              <input
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setCatalogModelId(null);
                }}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-800">
                Urun tipi
              </label>
              <select
                value={itemType}
                onChange={(e) => {
                  setItemType(e.target.value as InventoryItemType);
                  setCatalogModelId(null);
                }}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="hearing_aid">Isitme cihazi</option>
                <option value="charger">Sarj aleti</option>
              </select>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <label className="mb-1 block font-semibold text-slate-800">
                  Katalogda ara
                </label>
                <input
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                  placeholder="Marka veya model"
                />
              </div>
              <button
                type="button"
                onClick={handleCatalogSearch}
                disabled={catalogLoading}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                {catalogLoading ? 'Araniyor...' : 'Katalog ara'}
              </button>
            </div>

            {catalogRows.length > 0 && (
              <div className="mt-3 max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white">
                {catalogRows.map((catalogRow) => (
                  <button
                    key={`${catalogRow.catalogModelId}-${catalogRow.valid_from}`}
                    type="button"
                    onClick={() => handleSelectCatalog(catalogRow)}
                    className="block w-full border-b border-slate-100 px-2 py-2 text-left text-[11px] hover:bg-primary-50"
                  >
                    <span className="font-semibold text-slate-900">
                      {catalogRow.brand} {catalogRow.model}
                    </span>
                    <span className="ml-2 text-slate-500">
                      {catalogRow.itemType} | Gelis:{' '}
                      {formatMoneyTr(catalogRow.purchase_price) || '-'} | Liste:{' '}
                      {formatMoneyTr(catalogRow.list_price) || '-'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block font-semibold text-slate-800">
                Seri no
              </label>
              <input
                value={serialNo}
                onChange={(e) => {
                  setSerialNo(e.target.value);
                  setDuplicateRow(null);
                }}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-800">
                Barkod
              </label>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-800">
                Durum
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as InventoryStatus)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="in_stock">Stokta</option>
                <option value="repair">Tamirde</option>
                <option value="sold">Satildi</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleDuplicateCheck}
                disabled={duplicateLoading || !serialNo.trim()}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {duplicateLoading ? 'Kontrol...' : 'Seri no kontrol'}
              </button>
            </div>
          </div>

          {duplicateRow && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
              <div className="font-semibold">Bu seri no zaten aktif kayitta var.</div>
              <div>
                {duplicateRow.brand} {duplicateRow.model} | Durum:{' '}
                {duplicateRow.status} | Barkod: {duplicateRow.barcode ?? '-'}
              </div>
              <div className="mt-1 text-[10px]">
                Mevcut kayit degistirilmeyecek. Yeni urun eklemek icin seri no
                bilgisini duzeltin.
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block font-semibold text-slate-800">
                Gelis fiyati
              </label>
              <input
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-800">
                Liste fiyati
              </label>
              <input
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-800">
                Alis tarihi
              </label>
              <input
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                placeholder="YYYY-MM-DD veya GG.AA.YYYY"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-800">
                Cozum notu
              </label>
              <input
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-800">
              Not
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-16 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
          </div>

          {submitError && (
            <div className="rounded-md bg-red-50 p-2 text-[11px] text-red-700">
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Iptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Ekleniyor...' : 'Duzelt ve ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
