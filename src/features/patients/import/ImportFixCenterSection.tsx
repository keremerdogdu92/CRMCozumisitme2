// src/features/patients/import/ImportFixCenterSection.tsx
// Summary: "Import Fix Center" section for SettingsPage. Lists import_jobs for
// patients and legacy_patient_devices, shows summaries and error rows, and
// opens per-row fix modals for quick corrections.

import { useEffect, useState } from 'react';
import { supabaseClient } from '../../../utils/supabaseClient';
import type {
  PatientsImportStatusSummary,
  LegacyDevicesImportStatusSummary,
  PatientsImportRow,
  LegacyDevicesImportRow,
} from './types';
import {
  fetchPatientsImportErrorRows,
  fetchLegacyDevicesImportErrorRows,
  getPatientsImportJobSummary,
  getLegacyDevicesImportJobSummary,
} from './api.jobs';
import { LegacyDeviceRowFixModal } from './LegacyDeviceRowFixModal';
import { PatientRowFixModal } from './PatientRowFixModal';

type ImportJobRow = {
  id: string;
  org_id: string;
  target_entity: string;
  status: string;
  row_count: number | null;
  error_count: number | null;
  created_at: string;
  finished_at: string | null;
  source_filename: string | null;
};

type ImportDashboardTab = 'patients' | 'legacy';

export function ImportFixCenterSection() {
  const [activeTab, setActiveTab] = useState<ImportDashboardTab>('patients');

  const [jobs, setJobs] = useState<ImportJobRow[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const [selectedJob, setSelectedJob] = useState<ImportJobRow | null>(null);
  const [jobSummary, setJobSummary] = useState<
    PatientsImportStatusSummary | LegacyDevicesImportStatusSummary | null
  >(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [patientErrorRows, setPatientErrorRows] = useState<
    PatientsImportRow[]
  >([]);
  const [legacyErrorRows, setLegacyErrorRows] = useState<
    LegacyDevicesImportRow[]
  >([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  const [fixPatientRow, setFixPatientRow] = useState<PatientsImportRow | null>(
    null,
  );
  const [fixLegacyRow, setFixLegacyRow] =
    useState<LegacyDevicesImportRow | null>(null);

  // Load jobs when tab changes
  useEffect(() => {
    const loadJobs = async () => {
      setJobsLoading(true);
      setJobsError(null);
      setSelectedJob(null);
      setJobSummary(null);
      setPatientErrorRows([]);
      setLegacyErrorRows([]);
      setRowsError(null);

      const target =
        activeTab === 'patients' ? 'patients' : 'legacy_patient_devices';

      try {
        const { data, error } = await supabaseClient
          .from('import_jobs')
          .select(
            'id, org_id, target_entity, status, row_count, error_count, created_at, finished_at, source_filename',
          )
          .eq('target_entity', target)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          setJobsError('İmport job listesi alınamadı: ' + error.message);
          setJobs([]);
          return;
        }

        setJobs((data ?? []) as ImportJobRow[]);
      } finally {
        setJobsLoading(false);
      }
    };

    void loadJobs();
  }, [activeTab]);

  async function refreshSelectedJob(job: ImportJobRow | null) {
    if (!job) return;

    setSummaryLoading(true);
    setSummaryError(null);
    setRowsLoading(true);
    setRowsError(null);

    try {
      if (job.target_entity === 'patients') {
        const [summary, errorRows] = await Promise.all([
          getPatientsImportJobSummary(job.id),
          fetchPatientsImportErrorRows(job.id),
        ]);
        setJobSummary(summary);
        setPatientErrorRows(errorRows);
        setLegacyErrorRows([]);
      } else if (job.target_entity === 'legacy_patient_devices') {
        const [summary, errorRows] = await Promise.all([
          getLegacyDevicesImportJobSummary(job.id),
          fetchLegacyDevicesImportErrorRows(job.id),
        ]);
        setJobSummary(summary);
        setLegacyErrorRows(errorRows);
        setPatientErrorRows([]);
      } else {
        setJobSummary(null);
        setPatientErrorRows([]);
        setLegacyErrorRows([]);
      }
    } catch (err) {
      const msg =
        (err as Error)?.message ||
        'Job özeti veya hata satırları alınırken hata oluştu.';
      setSummaryError(msg);
      setRowsError(msg);
    } finally {
      setSummaryLoading(false);
      setRowsLoading(false);
    }
  }

  function handleSelectJob(job: ImportJobRow) {
    setSelectedJob(job);
    void refreshSelectedJob(job);
  }

  const showPatientErrors = selectedJob?.target_entity === 'patients';
  const showLegacyErrors =
    selectedJob?.target_entity === 'legacy_patient_devices';

  return (
    <div className="space-y-3 text-[11px]">
      {/* Tabs */}
      <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('patients')}
          className={`rounded px-3 py-1 font-medium ${
            activeTab === 'patients'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Hasta import jobs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('legacy')}
          className={`rounded px-3 py-1 font-medium ${
            activeTab === 'legacy'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Legacy cihaz import jobs
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
        {/* Jobs list */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900">
              Import jobs
            </h3>
          </div>
          {jobsLoading && (
            <div className="text-[11px] text-slate-500">
              Job listesi yükleniyor...
            </div>
          )}
          {jobsError && (
            <div className="rounded-md bg-red-50 p-2 text-[11px] text-red-700">
              {jobsError}
            </div>
          )}
          {!jobsLoading && !jobsError && jobs.length === 0 && (
            <div className="text-[11px] text-slate-500">
              Bu sekmede henüz hiç import job yok.
            </div>
          )}
          {!jobsLoading && !jobsError && jobs.length > 0 && (
            <ul className="mt-1 divide-y divide-slate-100">
              {jobs.map((job) => {
                const isActive = selectedJob?.id === job.id;
                return (
                  <li
                    key={job.id}
                    className={`cursor-pointer px-2 py-2 text-[11px] ${
                      isActive
                        ? 'bg-primary-50 text-primary-900'
                        : 'hover:bg-slate-100'
                    }`}
                    onClick={() => handleSelectJob(job)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">
                        {job.source_filename ?? '(isimsiz CSV)'}
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                        {job.status}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-600">
                      <span>
                        Rows: {job.row_count ?? '-'} | Errors:{' '}
                        {job.error_count ?? '-'}
                      </span>
                      <span>
                        Started:{' '}
                        {new Date(job.created_at).toLocaleString('tr-TR')}
                      </span>
                      {job.finished_at && (
                        <span>
                          Finished:{' '}
                          {new Date(job.finished_at).toLocaleString('tr-TR')}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Job summary + error rows */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          {!selectedJob && (
            <div className="text-[11px] text-slate-500">
              Detayları görmek için soldan bir import job seçin.
            </div>
          )}

          {selectedJob && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900">
                    Job detayları
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Job ID: {selectedJob.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => refreshSelectedJob(selectedJob)}
                  disabled={summaryLoading || rowsLoading}
                  className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {summaryLoading || rowsLoading ? 'Yenileniyor...' : 'Yenile'}
                </button>
              </div>

              {summaryError && (
                <div className="mb-2 rounded-md bg-red-50 p-2 text-[10px] text-red-700">
                  {summaryError}
                </div>
              )}

              {jobSummary && (
                <div className="mb-3 rounded-md bg-white p-2 text-[10px] text-slate-800">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <div>Toplam satır: {jobSummary.totalRows}</div>
                    <div>Imported: {jobSummary.importedRows}</div>
                    <div>Hata: {jobSummary.errorRows}</div>
                    <div>Validated: {jobSummary.validatedRows}</div>
                    <div>Warnings: {jobSummary.warningRows}</div>
                  </div>
                </div>
              )}

              <h4 className="mb-1 text-xs font-semibold text-slate-900">
                Hatalı satırlar
              </h4>

              {rowsError && (
                <div className="mb-2 rounded-md bg-red-50 p-2 text-[10px] text-red-700">
                  {rowsError}
                </div>
              )}

              {rowsLoading && (
                <div className="text-[11px] text-slate-500">
                  Hatalı satırlar yükleniyor...
                </div>
              )}

              {!rowsLoading &&
                showPatientErrors &&
                patientErrorRows.length === 0 && (
                  <div className="text-[11px] text-slate-500">
                    Bu job için hata satırı yok (veya hepsi düzeltildi).
                  </div>
                )}

              {!rowsLoading &&
                showLegacyErrors &&
                legacyErrorRows.length === 0 && (
                  <div className="text-[11px] text-slate-500">
                    Bu job için hata satırı yok (veya hepsi düzeltildi).
                  </div>
                )}

              {!rowsLoading &&
                showPatientErrors &&
                patientErrorRows.length > 0 && (
                  <div className="mt-1 max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-white">
                    <table className="min-w-full border-collapse text-[11px]">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-2 py-1 text-left font-semibold">
                            Row
                          </th>
                          <th className="px-2 py-1 text-left font-semibold">
                            Hata
                          </th>
                          <th className="px-2 py-1 text-left font-semibold">
                            İşlem
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {patientErrorRows.map((r) => (
                          <tr
                            key={r.id}
                            className="border-t border-slate-100 align-top"
                          >
                            <td className="px-2 py-1">
                              <div className="font-mono text-[10px]">
                                #{r.row_index}
                              </div>
                            </td>
                            <td className="px-2 py-1">
                              <div className="line-clamp-3 text-[10px] text-slate-700">
                                {r.error_message ?? '(detay yok)'}
                              </div>
                            </td>
                            <td className="px-2 py-1">
                              <button
                                type="button"
                                className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-slate-900"
                                onClick={() => setFixPatientRow(r)}
                              >
                                Düzelt
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              {!rowsLoading &&
                showLegacyErrors &&
                legacyErrorRows.length > 0 && (
                  <div className="mt-1 max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-white">
                    <table className="min-w-full border-collapse text-[11px]">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-2 py-1 text-left font-semibold">
                            Row
                          </th>
                          <th className="px-2 py-1 text-left font-semibold">
                            Hata
                          </th>
                          <th className="px-2 py-1 text-left font-semibold">
                            İşlem
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {legacyErrorRows.map((r) => (
                          <tr
                            key={r.id}
                            className="border-t border-slate-100 align-top"
                          >
                            <td className="px-2 py-1">
                              <div className="font-mono text-[10px]">
                                #{r.row_index}
                              </div>
                            </td>
                            <td className="px-2 py-1">
                              <div className="line-clamp-3 text-[10px] text-slate-700">
                                {r.error_message ?? '(detay yok)'}
                              </div>
                            </td>
                            <td className="px-2 py-1">
                              <button
                                type="button"
                                className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-slate-900"
                                onClick={() => setFixLegacyRow(r)}
                              >
                                Düzelt
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {fixPatientRow && selectedJob && (
        <PatientRowFixModal
          row={fixPatientRow}
          jobId={selectedJob.id}
          onClose={() => setFixPatientRow(null)}
          onFixed={() => {
            if (selectedJob) void refreshSelectedJob(selectedJob);
          }}
        />
      )}

      {fixLegacyRow && (
        <LegacyDeviceRowFixModal
          row={fixLegacyRow}
          onClose={() => setFixLegacyRow(null)}
          onFixed={() => {
            if (selectedJob) void refreshSelectedJob(selectedJob);
          }}
        />
      )}
    </div>
  );
}
