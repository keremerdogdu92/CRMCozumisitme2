// src/features/inventory/InventoryImportCard.tsx
// Inline card to import inventory items from a CSV file.
//
// Responsibilities:
// - Let user pick a CSV file.
// - Call useInventoryCsvImportMutation() to import rows.
// - Explain required/optional columns clearly so the user can validate
//   their Excel/CSV structure before import.
// - Show a compact summary (row counts + job id).

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
    (importMutation.isError
      ? (importMutation.error as Error).message
      : undefined);

  return (
    <InlineCreateCard
      title="Excel / CSV'den Stok İçe Aktar"
      description="Marka, model, tip, seri numarası ve (opsiyonel) hasta T.C. bilgilerini içeren CSV dosyasını yükleyerek toplu stok ekleyin."
      open={open}
      onToggle={onToggle}
      errorMessage={errorMessage}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2 md:items-start">
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
              Ayraç olarak virgül (<code>,</code>) veya noktalı virgül (
              <code>;</code>) kullanılabilir. Başlık satırı zorunludur.
            </p>

            {summary && (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
                <p>
                  Toplam satır: <strong>{summary.totalRows}</strong>
                </p>
                <p>
                  Başarıyla eklenen: <strong>{summary.importedCount}</strong>
                </p>
                <p>
                  Hatalı satır: <strong>{summary.errorCount}</strong>
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Import job ID:{' '}
                  <span className="font-mono">{summary.jobId}</span> — detaylı
                  hata için{' '}
                  <span className="font-mono">inventory_import_rows</span> ve{' '}
                  <span className="font-mono">import_jobs</span> tablolarına
                  bakabilirsiniz.
                </p>
              </div>
            )}
          </div>

          {/* CSV kolon açıklaması */}
          <div className="rounded-md bg-slate-50 p-3 text-[11px] text-slate-700">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              CSV kolonları
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ul className="space-y-1">
                <li>
                  <span className="font-semibold">Zorunlu:</span>{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    brand
                  </code>{' '}
                  veya{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    device_brand
                  </code>
                  ,{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    model
                  </code>{' '}
                  veya{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    device_model
                  </code>
                  .
                </li>
                <li>
                  <span className="font-semibold">Önerilen:</span>{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    item_type
                  </code>{' '}
                  (<span className="font-mono">hearing_aid</span> /
                  <span className="font-mono">charger</span>),{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    status
                  </code>{' '}
                  (<span className="font-mono">in_stock</span>,{' '}
                  <span className="font-mono">sold</span>,{' '}
                  <span className="font-mono">repair</span>),{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    purchase_price
                  </code>
                  ,{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    list_price
                  </code>{' '}
                  veya{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    device_price
                  </code>
                  .
                </li>
                <li>
                  <span className="font-semibold">Seri/Barkod:</span>{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    barcode
                  </code>
                  ,{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    serial_no
                  </code>
                  .
                </li>
              </ul>

              <ul className="space-y-1">
                <li>
                  <span className="font-semibold">Kulak:</span>{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    ear_side
                  </code>{' '}
                  (
                  <span className="font-mono">
                    right / left / bilateral / tek / çift
                  </span>
                  ).{' '}
                  <span className="text-[10px] text-slate-500">
                    Charger için otomatik olarak boş bırakılır.
                  </span>
                </li>
                <li>
                  <span className="font-semibold">Not:</span>{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    notes
                  </code>{' '}
                  (serbest metin; import sırasında ek açıklamalar için
                  kullanılabilir).
                </li>
                <li>
                  <span className="font-semibold">Hasta ile eşleştirme:</span>{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    patient_national_id
                  </code>{' '}
                  (opsiyonel). Bu alan doluysa, notlara{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5">
                    legacy_patient_national_id=...
                  </code>{' '}
                  şeklinde eklenir ve daha sonra SQL ile hastalara
                  bağlanabilir.
                </li>
              </ul>
            </div>

            <div className="mt-3">
              <p className="mb-1 text-[11px] font-semibold text-slate-500">
                Örnek başlık satırı:
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-slate-900 p-2 text-[10px] text-slate-50">
brand,model,item_type,barcode,serial_no,ear_side,status,purchase_price,list_price,notes,patient_national_id
              </pre>
            </div>
          </div>
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
