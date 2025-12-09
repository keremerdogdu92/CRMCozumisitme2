// src/features/inventory/InventoryImportCard.tsx
// Inline card to import inventory items from a CSV file.

import { FormEvent, useState, ChangeEvent } from 'react';
import { InlineCreateCard } from '../../components/layout/InlineCreateCard';
import { useInventoryCsvImportMutation } from './api';
import type { InventoryImportSummary } from './types';

type Props = {
  open: boolean;
  onToggle: () => void;
};

export function InventoryImportCard({ open, onToggle }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [summary, setSummary] = useState<InventoryImportSummary | null>(null);

  const importMutation = useInventoryCsvImportMutation();

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
      title="Excel / CSV'den Stok İçe Aktar"
      description="Marka, model, tip ve seri numarasını içeren CSV dosyasını yükleyerek toplu stok ekleyin."
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
                brand (veya device_brand), model (veya device_model),
                item_type, serial_no, barcode, status,
                purchase_price, list_price (veya device_price),
                purchase_date, notes
              </span>
              . Marka, model, item_type ve serial_no zorunludur. Diğer alanlar
              opsiyoneldir; geçersiz değerler için satır yine import edilir
              ancak{' '}
              <span className="font-mono">inventory_import_rows</span> tablosunda
              uyarı olarak işaretlenir.
            </p>
          </div>

          {summary && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
              <p>
                Toplam satır: <strong>{summary.totalRows}</strong>
              </p>
              <p>
                Başarıyla eklenen: <strong>{summary.importedCount}</strong>
              </p>
              <p>
                Bloklayan hatalı satır: <strong>{summary.errorCount}</strong>
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Import job ID: <span className="font-mono">{summary.jobId}</span> — detaylı
                hata ve uyarılar için{' '}
                <span className="font-mono">inventory_import_rows</span> ve{' '}
                <span className="font-mono">import_jobs</span> tablolarına
                bakabilirsiniz.
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
