// src/features/inventory/deviceCatalog/DeviceCatalogImportCard.tsx
// Summary: Inline card component to import device catalog prices from CSV.
// Usage:
// - Place inside an admin-only page (e.g. ProfitCalculatorPage top section).
// - Allows selecting a CSV file and runs the catalog import mutation.
// - Shows summary: total rows, successes, created/updated models, errors.

import { FormEvent, useState, ChangeEvent } from 'react';
import { InlineCreateCard } from '../../../components/layout/InlineCreateCard';
import {
  useDeviceCatalogImportMutation,
  type DeviceCatalogImportSummary,
} from './api';

type Props = {
  open: boolean;
  onToggle: () => void;
};

export function DeviceCatalogImportCard({ open, onToggle }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DeviceCatalogImportSummary | null>(null);

  const importMutation = useDeviceCatalogImportMutation();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    setSummary(null);

    const f = e.target.files?.[0] ?? null;
    setFile(f ?? null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSummary(null);

    if (!file) {
      setLocalError('Lütfen bir CSV dosyası seçin.');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setLocalError('Sadece .csv uzantılı dosyalar desteklenir.');
      return;
    }

    try {
      const result = await importMutation.mutateAsync(file);
      setSummary(result);
    } catch (err) {
      setLocalError((err as Error).message);
    }
  };

  const errorMessage =
    localError ??
    (importMutation.isError ? (importMutation.error as Error).message : undefined);

  return (
    <InlineCreateCard
      title="Excel / CSV'den Cihaz Kataloğu Fiyatlarını Güncelle"
      description="Marka, model ve fiyat bilgilerinin yer aldığı CSV dosyasını yükleyerek cihaz kataloğu fiyatlarını toplu güncelleyin. Bu işlem inventory stokları değil, cihaz model kataloğunu etkiler."
      open={open}
      onToggle={onToggle}
      errorMessage={errorMessage}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2 md:items-center">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              CSV Dosyası
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-primary-600 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-primary-700"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Beklenen başlıklar:{' '}
              <span className="font-mono">
                brand, model, item_type, purchase_price, list_price, details,
                battery_type, valid_from
              </span>
              .
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Zorunlu alanlar:{' '}
              <span className="font-mono">
                brand, model, item_type, purchase_price, list_price
              </span>
              .{' '}
              <span className="font-mono">valid_from</span> boş bırakılırsa,
              bugünün tarihi (YYYY-MM-DD) kullanılır ve fiyat o günden itibaren
              geçerli kabul edilir.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Aynı org içinde aynı{' '}
              <span className="font-mono">brand + model + item_type</span>{' '}
              kombinasyonu varsa model tekrar oluşturulmaz, yalnızca yeni{' '}
              <span className="font-mono">valid_from</span> tarihi ile ek bir
              fiyat satırı eklenir.
            </p>
          </div>

          {summary && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
              <p>
                Toplam satır: <strong>{summary.totalRows}</strong>
              </p>
              <p>
                Başarılı fiyat satırı: <strong>{summary.successCount}</strong>
              </p>
              <p>
                Yeni model sayısı: <strong>{summary.createdModelCount}</strong>
              </p>
              <p>
                Mevcut modele eklenen fiyat sayısı:{' '}
                <strong>{summary.updatedModelCount}</strong>
              </p>
              <p>
                Hatalı satır: <strong>{summary.errorCount}</strong>
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Hatalı satırlar import sırasında log&apos;lara yazılır. Gerekirse
                Supabase tarafında{' '}
                <span className="font-mono">
                  device_catalog_models / device_catalog_prices
                </span>{' '}
                tablolarına bakabilirsiniz.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={importMutation.isPending}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {importMutation.isPending ? 'İçe aktarılıyor...' : 'CSV İçe Aktar'}
          </button>
        </div>
      </form>
    </InlineCreateCard>
  );
}
