// src/features/patients/components/import/LegacyDevicesImportSection.tsx
// Legacy patient devices CSV import UI wired to the staging + processor pipeline.
//
// This is ONLY for "eski hasta cihazları" and expects the CSV columns:
//   - patient_national_id (zorunlu, 11 hane)
//   - device_brand        (zorunlu)
//   - device_model        (zorunlu)
//   - ear_side            (zorunlu: R / L / Tek / Çift / çift vs.)
//   - serial_no           (opsiyonel)
//   - sold_at             (opsiyonel, dd.MM.yyyy veya yyyy-MM-dd)
//   - device_price        (opsiyonel, satırdaki tüm cihaz+aksesuar toplamı)
//
// Rows are staged into patients_legacy_devices_import_rows and then processed
// server-side by /api/legacy-patient-devices-import-processor.

import { useState, type ChangeEvent } from 'react';
import {
  createLegacyDevicesImportJob,
  getLegacyDevicesImportJobSummary,
  insertLegacyDevicesImportRows,
} from '../../import/api.jobs';
import type { LegacyDevicesImportStatusSummary } from '../../import/types';
import { parseSimpleCsv } from '../../../../utils/csvUtils';
import { normalizeHeaderKey } from '../../import/legacyDevicesValidator';

type ImportPhase = 'idle' | 'uploading' | 'processing';

export function LegacyDevicesImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [summary, setSummary] =
    useState<LegacyDevicesImportStatusSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setSummary(null);
    setError(null);
    setJobId(null);
  };

  const handleImport = async () => {
    if (!file) return;

    setError(null);
    setSummary(null);
    setPhase('uploading');

    try {
      const text = await file.text();
      const { headers, rows } = parseSimpleCsv(text);

      if (headers.length === 0 || rows.length === 0) {
        throw new Error('CSV appears to be empty.');
      }

      const normalizedHeaders = headers.map((h) => normalizeHeaderKey(h));

      // Basic header validation: make sure required columns exist.
      const requiredCols = [
        'patient_national_id',
        'device_brand',
        'device_model',
        'ear_side',
      ] as const;

      const missingRequired = requiredCols.filter(
        (col) => !normalizedHeaders.includes(col),
      );

      if (missingRequired.length > 0) {
        throw new Error(
          `Missing required columns: ${missingRequired.join(
            ', ',
          )}. Please use the legacy_patient_devices.csv template.`,
        );
      }

      const stagedRows = rows.map((cols, idx) => {
        const rowObj: Record<string, string> = {};
        normalizedHeaders.forEach((key, colIdx) => {
          rowObj[key] = cols[colIdx] ?? '';
        });
        return { rowIndex: idx + 1, rawRow: rowObj };
      });

      const { jobId: createdJobId, orgId } = await createLegacyDevicesImportJob(
        file.name || 'legacy_patient_devices.csv',
        stagedRows.length,
      );
      setJobId(createdJobId);

      await insertLegacyDevicesImportRows(createdJobId, orgId, stagedRows);

      setPhase('processing');

      const response = await fetch(
        '/api/legacy-patient-devices-import-processor',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: createdJobId }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
          body?.error || `Processor request failed with ${response.status}`;
        throw new Error(message);
      }

      const nextSummary =
        await getLegacyDevicesImportJobSummary(createdJobId);
      setSummary(nextSummary);
    } catch (err) {
      setError((err as Error)?.message || 'Legacy devices import failed.');
    } finally {
      setPhase('idle');
    }
  };

  const isBusy = phase !== 'idle';

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Eski Hasta Cihazlarını İçe Aktar (legacy, staged)
          </h3>
          <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
            Satırlar{' '}
            <code className="font-mono">
              patients_legacy_devices_import_rows
            </code>{' '}
            tablosuna staged edilir ve import job pipeline ile işlenir.
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
            onClick={handleImport}
            disabled={!file || isBusy}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {phase === 'uploading'
              ? 'Uploading...'
              : phase === 'processing'
                ? 'Processing...'
                : 'Import Legacy Devices CSV'}
          </button>
        </div>
      </div>

      <div className="rounded-md bg-slate-50 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          CSV columns (legacy_patient_devices.csv)
        </p>
        <div className="grid gap-2 text-[11px] text-slate-700 sm:grid-cols-2">
          <ul className="space-y-1">
            <li>
              <span className="font-semibold">Required:</span>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                patient_national_id
              </code>
              ,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                device_brand
              </code>
              ,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                device_model
              </code>
              ,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                ear_side
              </code>
            </li>
            <li>
              <span className="font-semibold">Ear side values:</span>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">R</code>,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">L</code>,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">Tek</code>,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">Çift</code>{' '}
              (Sağ/Sol/Çift/Tek gibi Türkçe varyasyonlar da kabul edilir).
            </li>
          </ul>
          <ul className="space-y-1">
            <li>
              <span className="font-semibold">Optional:</span>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                serial_no
              </code>
              ,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                sold_at
              </code>{' '}
              (dd.MM.yyyy veya yyyy-MM-dd),{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                device_price
              </code>{' '}
              (satırdaki tüm cihaz+aksesuar toplamı).
            </li>
            <li>
              <span className="font-semibold">Note:</span>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                patient_national_id
              </code>{' '}
              üzerinden mevcut hastalarla eşleşme yapılır; hasta tarafındaki
              bilgiler her zaman override eder.
            </li>
          </ul>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-2 text-[11px] text-red-700">
          Import failed: {error}
        </div>
      )}

      {summary && (
        <div className="rounded-md bg-emerald-50 p-3 text-[11px] text-emerald-900">
          <p className="font-semibold">
            Legacy devices import completed for job {jobId ?? '-'}.
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <li>Total rows: {summary.totalRows}</li>
            <li>Imported: {summary.importedRows}</li>
            <li>Errors: {summary.errorRows}</li>
            <li>Validated: {summary.validatedRows}</li>
            <li>Warnings: {summary.warningRows}</li>
          </ul>
        </div>
      )}
    </section>
  );
}
