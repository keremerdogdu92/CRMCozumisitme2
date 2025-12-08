// api/legacy-patient-devices-import-processor.ts
// Summary: Serverless processor for LEGACY patient-device CSV imports.
// Phase 1: validates staging rows (patients_legacy_devices_import_rows),
// links them to patients by patient_national_id, and updates row/job status.
// It does NOT yet insert into devices / patient_devices – that will be Phase 2.
//
// Semantics (agreed):
// - device_brand + device_model: required.
// - ear_side: required (R / L / Tek / Çift, TR varyasyonlar kabul).
// - serial_no: optional.
// - sold_at: optional, dd.MM.yyyy veya yyyy-MM-dd (T00:00:00.000Z'e normalize edilir).
// - device_price: optional, "bu satırdaki tüm cihaz(lar) + aksesuarların toplam satış fiyatı".
// - Hasta tarafındaki satış tutarı ve diğer bilgiler her zaman patient tarafında
//   override edici kabul edilir; burada sadece legacy cihazları bağlamak için kullanıyoruz.

import { createClient } from '@supabase/supabase-js';
import type {
  LegacyDeviceImportIssue,
  LegacyDeviceImportNormalizedPayload,
} from '../src/features/patients/import/legacyDevicesValidator';
import { validateLegacyDeviceRow } from '../src/features/patients/import/legacyDevicesValidator';

// ------------------------
// Local staging row type
// ------------------------

type LegacyDeviceStagingRow = {
  id: string;
  org_id: string;
  job_id: string;
  row_index: number;
  raw_row: Record<string, any>;
  normalized_payload: LegacyDeviceImportNormalizedPayload | null;
  status: 'pending' | 'validated' | 'error' | 'imported';
  error_message: string | null;
  duplicate_of_device_id: string | null;
  created_at: string;
  validated_at: string | null;
  imported_at: string | null;
};

type ApiRequest = {
  method?: string;
  body?: any;
  query: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => {
    json: (body: any) => void;
  };
};

// Minimal process declaration (env only)
declare const process: {
  env: {
    SUPABASE_URL?: string;
    VITE_SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    SUPABASE_SERVICE_ROLE?: string;
    [key: string]: string | undefined;
  };
};

// ------------------------
// Supabase admin client
// ------------------------

function createAdminSupabaseClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl) {
    throw new Error(
      'Missing SUPABASE_URL (or VITE_SUPABASE_URL) environment variable.',
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY) environment variable.',
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function aggregateIssues(issues: LegacyDeviceImportIssue[]): string | null {
  if (!issues.length) return null;
  return issues.map((i) => `${i.field}: ${i.message}`).join('; ');
}

// ------------------------
// Supabase helpers
// ------------------------

async function fetchLegacyStagingRows(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  jobId: string,
): Promise<LegacyDeviceStagingRow[]> {
  const { data, error } = await supabase
    .from('patients_legacy_devices_import_rows')
    .select(
      'id, org_id, job_id, row_index, raw_row, normalized_payload, status, error_message, duplicate_of_device_id, created_at, validated_at, imported_at',
    )
    .eq('job_id', jobId)
    .in('status', ['pending', 'validated'])
    .order('row_index', { ascending: true });

  if (error) {
    throw new Error(
      'Failed to load legacy device staging rows: ' + error.message,
    );
  }

  return (data ?? []) as LegacyDeviceStagingRow[];
}

async function updateLegacyStagingRow(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  rowId: string,
  payload: Partial<LegacyDeviceStagingRow> & {
    normalized_payload?: LegacyDeviceImportNormalizedPayload | null;
    validated_at?: string | null;
    imported_at?: string | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from('patients_legacy_devices_import_rows')
    .update(payload)
    .eq('id', rowId);

  if (error) {
    throw new Error(
      'Failed to update legacy device staging row: ' + error.message,
    );
  }
}

async function countLegacyRowsByStatus(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  jobId: string,
  status?: 'pending' | 'validated' | 'error' | 'imported',
): Promise<number> {
  let query = supabase
    .from('patients_legacy_devices_import_rows')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId);

  if (status) {
    query = query.eq('status', status);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error('Failed to count legacy device rows: ' + error.message);
  }
  return count ?? 0;
}

/**
 * Check if a patient exists for given national_id + org_id.
 * This is a VALIDATION step only; we don't write patient_id into payload yet.
 */
async function ensurePatientExists(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  orgId: string,
  nationalId: string,
): Promise<'ok' | 'missing' | 'multiple'> {
  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('org_id', orgId)
    .eq('national_id', nationalId);

  if (error) {
    throw new Error(
      `Failed to check patient for national_id=${nationalId}: ${error.message}`,
    );
  }

  const rows = (data ?? []) as { id: string }[];
  if (rows.length === 0) return 'missing';
  if (rows.length > 1) return 'multiple';
  return 'ok';
}

// ------------------------
// Handler
// ------------------------

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const jobId =
      (req.body && typeof req.body.job_id === 'string' && req.body.job_id) ||
      (req.body && typeof req.body.jobId === 'string' && req.body.jobId) ||
      (typeof req.query.job_id === 'string' ? req.query.job_id : null) ||
      (typeof req.query.jobId === 'string' ? req.query.jobId : null);

    if (!jobId) {
      res.status(400).json({ error: 'job_id is required' });
      return;
    }

    let supabase: ReturnType<typeof createAdminSupabaseClient>;
    try {
      supabase = createAdminSupabaseClient();
    } catch (err) {
      console.error('Supabase admin client creation failed:', err);
      res.status(500).json({ error: (err as Error).message });
      return;
    }

    let stagingRows: LegacyDeviceStagingRow[] = [];
    try {
      stagingRows = await fetchLegacyStagingRows(supabase, jobId);
    } catch (err) {
      console.error('Failed to fetch legacy device staging rows:', err);
      res.status(500).json({ error: (err as Error).message });
      return;
    }

    // Phase 1: validation + patient existence check.
    for (const row of stagingRows) {
      if (row.status === 'pending') {
        const { normalized, issues } = validateLegacyDeviceRow({
          rawRow: row.raw_row,
          orgId: row.org_id,
          rowIndex: row.row_index,
        });

        // Patient existence check (only if normalization succeeded)
        if (normalized?.patient_national_id) {
          try {
            const patientStatus = await ensurePatientExists(
              supabase,
              row.org_id,
              normalized.patient_national_id,
            );

            if (patientStatus === 'missing') {
              issues.push({
                row_index: row.row_index,
                field: 'patient_national_id',
                severity: 'error',
                message:
                  'No patient found for this national_id in this organization. Import patients first.',
              });
            } else if (patientStatus === 'multiple') {
              issues.push({
                row_index: row.row_index,
                field: 'patient_national_id',
                severity: 'error',
                message:
                  'Multiple patients found for this national_id in this organization. Please resolve manually.',
              });
            }
          } catch (err) {
            console.error('ensurePatientExists failed:', err);
            res.status(500).json({ error: (err as Error).message });
            return;
          }
        }

        const hasError = issues.some((i) => i.severity === 'error');
        const nextStatus: LegacyDeviceStagingRow['status'] = hasError
          ? 'error'
          : 'validated';
        const errorMessage = aggregateIssues(issues);

        try {
          await updateLegacyStagingRow(supabase, row.id, {
            status: nextStatus,
            normalized_payload: hasError ? null : normalized,
            error_message: errorMessage,
            validated_at: nowIso(),
          });
        } catch (err) {
          console.error(
            'Update legacy device staging row (pending) failed:',
            err,
          );
          res.status(500).json({ error: (err as Error).message });
          return;
        }
      } else if (row.status === 'validated' && row.normalized_payload) {
        // Optional: re-check that the patient still exists.
        const issues: LegacyDeviceImportIssue[] = [];
        try {
          const result = await ensurePatientExists(
            supabase,
            row.org_id,
            row.normalized_payload.patient_national_id,
          );
          if (result === 'missing') {
            issues.push({
              row_index: row.row_index,
              field: 'patient_national_id',
              severity: 'error',
              message:
                'No patient found for this national_id in this organization. Import patients first.',
            });
          } else if (result === 'multiple') {
            issues.push({
              row_index: row.row_index,
              field: 'patient_national_id',
              severity: 'error',
              message:
                'Multiple patients found for this national_id in this organization. Please resolve manually.',
            });
          }
        } catch (err) {
          console.error(
            'ensurePatientExists failed for validated row:',
            err,
          );
          res.status(500).json({ error: (err as Error).message });
          return;
        }

        const hasError = issues.some((i) => i.severity === 'error');
        if (hasError) {
          const errorMessage = aggregateIssues(issues);
          try {
            await updateLegacyStagingRow(supabase, row.id, {
              status: 'error',
              normalized_payload: null,
              error_message: errorMessage,
            });
          } catch (err) {
            console.error(
              'Update legacy device staging row (validated->error) failed:',
              err,
            );
            res.status(500).json({ error: (err as Error).message });
            return;
          }
        }
      }
    }

    // Job summary (Phase 1: validation-only)
    try {
      const [totalRows, validatedRows, errorRows] = await Promise.all([
        countLegacyRowsByStatus(supabase, jobId),
        countLegacyRowsByStatus(supabase, jobId, 'validated'),
        countLegacyRowsByStatus(supabase, jobId, 'error'),
      ]);

      let nextStatus: 'completed' | 'failed' = 'completed';
      let jobErrorMessage: string | null = null;

      if (validatedRows === 0 && errorRows > 0) {
        nextStatus = 'failed';
        jobErrorMessage = 'All legacy device rows failed validation.';
      } else if (errorRows > 0) {
        nextStatus = 'completed';
        jobErrorMessage = 'Some legacy device rows failed validation.';
      }

      await supabase
        .from('import_jobs')
        .update({
          status: nextStatus,
          finished_at: nowIso(),
          error_count: errorRows,
          row_count: totalRows,
          error_message: jobErrorMessage,
        })
        .eq('id', jobId);

      res.status(200).json({
        job_id: jobId,
        total_rows: totalRows,
        validated_rows: validatedRows,
        error_rows: errorRows,
        // imported_rows intentionally 0 in Phase 1 – no devices created yet.
        imported_rows: 0,
      });
    } catch (err) {
      console.error('Final legacy device job status update failed:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  } catch (err) {
    console.error(
      'Unhandled error in legacy-patient-devices-import-processor:',
      err,
    );
    res.status(500).json({ error: 'Unhandled server error.' });
  }
}
