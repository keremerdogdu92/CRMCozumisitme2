// src/features/patients/PatientsImportSection.tsx
// Reusable CSV import section for Patients feature.
// Can be rendered on PatientsPage now, and later moved to a Settings page.
//
// Responsibilities:
//  - Let user pick a CSV file.
//  - Call usePatientsCsvImportMutation() to import rows via createPatient.
//  - Show a clear explanation of required/optional columns.
//  - Display a compact summary + per-row errors (if any).

import { useState, type ChangeEvent } from 'react';
import { usePatientsCsvImportMutation } from './api.import';
import type { PatientsImportSummary } from './api.import';

export function PatientsImportSection() {
  const importMutation = usePatientsCsvImportMutation();
  const [file, setFile] = useState<File | null>(null);
  const [lastSummary, setLastSummary] = useState<PatientsImportSummary | null>(
    null,
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    // Yeni dosya seçildiğinde önceki sonucu temizleyebiliriz
    setLastSummary(null);
  };

  const handleImportClick = () => {
    if (!file) return;

    importMutation.mutate(file, {
      onSuccess: (summary) => {
        setLastSummary(summary);
      },
    });
  };

  const isRunning = importMutation.isPending;

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            CSV&apos;den Hasta İçe Aktar
          </h3>
          <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
            Eski sistemden aldığınız hasta listesini{' '}
            <span className="font-medium">full_name</span> ve diğer kolonlar ile
            CSV olarak içe aktarabilirsiniz. Her satır arka planda{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">
              createPatient
            </code>{' '}
            akışıyla kaydedilir.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block w-full text-xs text-slate-700 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200 sm:w-64"
          />
          <button
            type="button"
            onClick={handleImportClick}
            disabled={!file || isRunning}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {isRunning ? 'İçe aktarılıyor...' : 'CSV ile içe aktar'}
          </button>
        </div>
      </div>

      {/* Kolon açıklaması */}
      <div className="rounded-md bg-slate-50 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          CSV kolonları
        </p>
        <div className="grid gap-2 text-[11px] text-slate-700 sm:grid-cols-2">
          <ul className="space-y-1">
            <li>
              <span className="font-semibold">Zorunlu:</span>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                full_name
              </code>{' '}
              veya{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                ad_soyad
              </code>
            </li>
            <li>
              <span className="font-semibold">Önerilen:</span>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">phone</code>,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                national_id
              </code>
              ,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                kin_phone
              </code>
              ,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">address</code>
            </li>
            <li>
              <span className="font-semibold">Referans:</span>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                reference_name
              </code>{' '}
              (sadece isim; ID atanmaz)
            </li>
          </ul>
          <ul className="space-y-1">
            <li>
              <span className="font-semibold">SGK kolonları:</span>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                sgk_flag
              </code>
              ,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                sgk_prescription_received
              </code>
              ,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                sgk_recorded_to_system
              </code>
              . Değerler:{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                1/0, true/false, evet/hayir
              </code>
              .
            </li>
            <li>
              <span className="font-semibold">Ödeme kolonları:</span>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                payment_method
              </code>
              ,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                card_sale_total
              </code>
              ,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                card_fee_rate
              </code>
              . Bunlar normal &quot;Yeni Hasta&quot; formundaki alanlara birebir
              gider.
            </li>
          </ul>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold text-slate-500">
            Örnek başlık satırı:
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-slate-900 p-2 text-[10px] text-slate-50">
full_name,phone,national_id,kin_phone,address,reference_name,sgk_flag,sgk_prescription_received,sgk_recorded_to_system,payment_method,card_sale_total,card_fee_rate
          </pre>
        </div>
      </div>

      {/* Sonuç özet kutusu */}
      {lastSummary && (
        <div className="rounded-md bg-emerald-50 p-3 text-[11px] text-emerald-900">
          <p className="font-semibold">
            İçe aktarma tamamlandı: {lastSummary.importedCount} satır eklendi,{' '}
            {lastSummary.errorCount} satır hatalı.
          </p>
          {lastSummary.errorCount > 0 && (
            <div className="mt-2 max-h-40 overflow-auto rounded border border-emerald-100 bg-white/70 p-2 text-[10px] text-emerald-900">
              <p className="mb-1 font-semibold">
                Hatalı satırlar (Excel satır numarası):
              </p>
              <ul className="space-y-1">
                {lastSummary.rowErrors.map((err) => (
                  <li key={err.rowIndex}>
                    <span className="font-semibold">Satır {err.rowIndex}:</span>{' '}
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Genel hata mesajı */}
      {importMutation.isError && !lastSummary && (
        <div className="rounded-md bg-red-50 p-2 text-[11px] text-red-700">
          İçe aktarma sırasında bir hata oluştu:{' '}
          {(importMutation.error as Error).message}
        </div>
      )}
    </section>
  );
}
