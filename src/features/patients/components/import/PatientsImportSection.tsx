// src/features/patients/components/import/PatientsImportSection.tsx
// Patients CSV import UI wired to the v2 staging + processor pipeline.
import { useState, type ChangeEvent } from 'react';
import {
  createPatientsImportJob,
  getPatientsImportJobSummary,
  insertPatientsImportRows,
} from '../../import/api.jobs';
import type { PatientsImportStatusSummary } from '../../import/types';
import { parseSimpleCsv } from '../../../../utils/csvUtils';
import { normalizeHeaderKey } from '../../patientsImportUtils';

type ImportPhase = 'idle' | 'uploading' | 'processing';

export function PatientsImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [summary, setSummary] = useState<PatientsImportStatusSummary | null>(
    null,
  );
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
      const stagedRows = rows.map((cols, idx) => {
        const rowObj: Record<string, string> = {};
        normalizedHeaders.forEach((key, colIdx) => {
          rowObj[key] = cols[colIdx] ?? '';
        });
        return { rowIndex: idx + 1, rawRow: rowObj };
      });

      const { jobId: createdJobId, orgId } = await createPatientsImportJob(
        file.name || 'patients.csv',
        stagedRows.length,
      );
      setJobId(createdJobId);

      await insertPatientsImportRows(createdJobId, orgId, stagedRows);

      setPhase('processing');

      const response = await fetch('/api/patients-import-processor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: createdJobId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
          body?.error || `Processor request failed with ${response.status}`;
        throw new Error(message);
      }

      const nextSummary = await getPatientsImportJobSummary(createdJobId);
      setSummary(nextSummary);
    } catch (err) {
      setError((err as Error)?.message || 'Import failed.');
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
            CSV&apos;den Hasta İçe Aktar (v2, staged)
          </h3>
          <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
            Rows are staged into <code className="font-mono">patients_import_rows</code> and
            processed via the import job pipeline.
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
                : 'Import CSV'}
          </button>
        </div>
      </div>

      <div className="rounded-md bg-slate-50 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          CSV columns
        </p>
        <div className="grid gap-2 text-[11px] text-slate-700 sm:grid-cols-2">
          <ul className="space-y-1">
            <li>
              <span className="font-semibold">Required:</span>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">full_name</code>{' '}
              or{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">ad_soyad</code>
            </li>
            <li>
              <span className="font-semibold">Identity:</span>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">phone</code>,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">national_id</code>
            </li>
          </ul>
          <ul className="space-y-1">
            <li>
              <span className="font-semibold">Payment:</span>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">payment_method</code>,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">sale_total</code>{' '}
              (or legacy{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">card_sale_total</code>
              ),{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">card_fee_rate</code>
            </li>
            <li>
              <span className="font-semibold">Optional:</span>{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">sgk_flag</code>,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">sgk_prescription_received</code>
              ,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">sgk_recorded_to_system</code>,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">sale_date</code>
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
            Import completed for job {jobId ?? '-'}.
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
