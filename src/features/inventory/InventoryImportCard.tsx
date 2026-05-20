// src/features/inventory/InventoryImportCard.tsx
// Inline card to import inventory items from CSV.

import { FormEvent, useState, ChangeEvent } from 'react';
import { InlineCreateCard } from '../../components/layout/InlineCreateCard';
import { useInventoryCsvImportMutation } from './api.import';
import type { InventoryImportSummary } from './types';
import inventoryImportTemplateUrl from '../../../templates/inventory_import_template.csv?url';

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
    setFile(e.target.files?.[0] ?? null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSummary(null);

    if (!file) {
      setLocalError('Lutfen bir CSV dosyasi secin.');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setLocalError('Sadece .csv uzantili dosyalar desteklenir.');
      return;
    }

    try {
      setSummary(await importMutation.mutateAsync(file));
    } catch (err) {
      setLocalError((err as Error).message);
    }
  };

  const errorMessage =
    localError ??
    (importMutation.isError
      ? (importMutation.error as Error).message
      : undefined);

  const isSubmitDisabled = importMutation.isPending || !file;

  return (
    <InlineCreateCard
      title="CSV'den Stok Ice Aktar"
      description="Yeni stoklari CSV ile yukler. Fiyat alanlari bossa katalog fiyatlari kullanilir; eslesmeyen veya duplicate satirlar hata merkezinde duzeltilebilir."
      open={open}
      onToggle={onToggle}
      errorMessage={errorMessage}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2 md:items-start">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-medium text-slate-600">
                CSV Dosyasi
              </label>
              <a
                href={inventoryImportTemplateUrl}
                download="inventory_import_template.csv"
                className="text-[11px] font-medium text-primary-700 hover:text-primary-800"
              >
                Template indir
              </a>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-primary-600 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-primary-700"
            />
            <div className="mt-2 space-y-1 text-[11px] text-slate-500">
              <p>
                Zorunlu alanlar:{' '}
                <span className="font-mono">brand, model, item_type, serial_no</span>
                .
              </p>
              <p>
                Fiyatlar bossa sistem once barkod/katalog eslesmesi, sonra
                normalize marka+model+tip eslesmesi dener. Eslesme yoksa sadece
                ilgili satir hata olur.
              </p>
              <p>
                Ayni seri no zaten aktif stokta varsa veya CSV icinde tekrar
                ediyorsa satir iceri alinmaz; Import Fix Center uzerinden
                duzeltilebilir.
              </p>
            </div>
          </div>

          {summary && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
              <p>
                Toplam satir: <strong>{summary.totalRows}</strong>
              </p>
              <p>
                Basariyla eklenen: <strong>{summary.importedCount}</strong>
              </p>
              <p>
                Hatali satir: <strong>{summary.errorCount}</strong>
              </p>
              <p>
                Uyarili satir: <strong>{summary.warningCount}</strong>
              </p>
              <p>
                Duplicate seri no: <strong>{summary.duplicateCount}</strong>
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Job ID: <span className="font-mono">{summary.jobId}</span>.
                Hata veren satirlari Import Fix Center &gt; Stok import
                hatalari sekmesinden duzeltebilirsiniz.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {importMutation.isPending ? 'Ice aktariliyor...' : 'CSV Ice Aktar'}
          </button>
        </div>
      </form>
    </InlineCreateCard>
  );
}
