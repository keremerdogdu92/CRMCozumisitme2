// api/patients-import-processor.ts
// Vercel serverless processor: validate staging rows, detect duplicates, insert patients, and update import_jobs.

import { createClient } from '@supabase/supabase-js';
import { validatePatientsRow } from '../src/features/patients/import/validator';
import type {
  PatientsImportIssue,
  PatientsImportNormalizedPayload,
} from '../src/features/patients/import/types';

// Minimal request/response shapes so we don't depend on @vercel/node types.
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

// Minimal process declaration so we don't need @types/node just for env access.
// Runtime'da gerçek process Node tarafından sağlanıyor.
declare const process: {
  env: {
    SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    [key: string]: string | undefined;
  };
};

type StagingRow = {
  id: string;
  org_id: string;
  job_id: string;
  row_index: number;
  raw_row: Record<string, any>;
  normalized_payload: PatientsImportNormalizedPayload | null;
  status: 'pending' | 'validated' | 'error' | 'imported';
  duplicate_of_patient_id: string | null;
  error_message: string | null;
};

function createAdminSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL environment variable.');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function aggregateIssues(issues: PatientsImportIssue[]): string | null {
  if (!issues.length) return null;
  return issues.map((i) => `${i.field}: ${i.message}`).join('; ');
}

function nowIso(): string {
  return new Date().toISOString();
}

async function detectDuplicatePatientId(params: {
  supabase: ReturnType<typeof createAdminSupabaseClient>;
  orgId: string;
  nationalId: string | null;
}: Promise<string | null> {
  const { supabase, orgId, nationalId } = params;
  if (!nationalId) return null;

  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('org_id', orgId)
    .eq('national_id', nationalId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('Duplicate check failed: ' + error.message);
  }

  return data?.id ?? null;
}

async function fetchStagingRows(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  jobId: string,
): Promise<StagingRow[]> {
  const { data, error } = await supabase
    .from('patients_import_rows')
    .select(
      'id, org_id, job_id, row_index, raw_row, normalized_payload, status, duplicate_of_patient_id, error_message',
    )
    .eq('job_id', jobId)
    .in('status', ['pending', 'validated'])
    .order('row_index', { ascending: true });

  if (error) {
    throw new Error('Failed to load staging rows: ' + error.message);
  }

  return (data ?? []) as StagingRow[];
}

async function updateStagingRow(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  rowId: string,
  payload: Partial<StagingRow> & {
    normalized_payload?: PatientsImportNormalizedPayload | null;
    validated_at?: string | null;
    imported_at?: string | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from('patients_import_rows')
    .update(payload)
    .eq('id', rowId);

  if (error) {
    throw new Error('Failed to update staging row: ' + error.message);
  }
}

async function insertPatient(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  payload: PatientsImportNormalizedPayload,
): Promise<string> {
  const { data, error } = await supabase
    .from('patients')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    throw new Error('Failed to insert patient: ' + error.message);
  }

  return (data as any).id as string;
}

async function countByStatus(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  jobId: string,
  status?: string,
): Promise<number> {
  let query = supabase
    .from('patients_import_rows')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId);

  if (status) {
    query = query.eq('status', status);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error('Failed to count rows: ' + error.message);
  }
  return count ?? 0;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
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

  let supabase;
  try {
    supabase = createAdminSupabaseClient();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
    return;
  }

  let stagingRows: StagingRow[] = [];
  try {
    stagingRows = await fetchStagingRows(supabase, jobId);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
    return;
  }

  const rowsReadyForInsert: Array<{
    rowId: string;
    payload: PatientsImportNormalizedPayload;
    errorMessage: string | null;
  }> = [];

  for (const row of stagingRows) {
    if (row.status === 'pending') {
      const { normalized, issues } = validatePatientsRow({
        rawRow: row.raw_row,
        orgId: row.org_id,
        rowIndex: row.row_index,
      });

      let duplicateId: string | null = null;
      if (normalized?.national_id) {
        try {
          duplicateId = await detectDuplicatePatientId({
            supabase,
            orgId: row.org_id,
            nationalId: normalized.national_id,
          });
          if (duplicateId) {
            issues.push({
              row_index: row.row_index,
              field: 'national_id',
              severity: 'error',
              message: 'Duplicate national_id exists for this org.',
              duplicate_of_patient_id: duplicateId,
            });
          }
        } catch (err) {
          res.status(500).json({ error: (err as Error).message });
          return;
        }
      }

      const hasError = issues.some((i) => i.severity === 'error');
      const nextStatus = hasError ? 'error' : 'validated';
      const errorMessage = aggregateIssues(issues);

      try {
        await updateStagingRow(supabase, row.id, {
          status: nextStatus as StagingRow['status'],
          normalized_payload: hasError ? null : normalized,
          error_message: errorMessage,
          duplicate_of_patient_id: duplicateId,
          validated_at: nowIso(),
        });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
        return;
      }

      if (!hasError && normalized) {
        rowsReadyForInsert.push({
          rowId: row.id,
          payload: normalized,
          errorMessage,
        });
      }
    } else if (row.status === 'validated' && row.normalized_payload) {
      // Re-check duplicates for already-validated rows before inserting.
      const issues: PatientsImportIssue[] = [];
      let duplicateId: string | null = null;

      if (row.normalized_payload.national_id) {
        try {
          duplicateId = await detectDuplicatePatientId({
            supabase,
            orgId: row.org_id,
            nationalId: row.normalized_payload.national_id,
          });
          if (duplicateId) {
            issues.push({
              row_index: row.row_index,
              field: 'national_id',
              severity: 'error',
              message: 'Duplicate national_id exists for this org.',
              duplicate_of_patient_id: duplicateId,
            });
          }
        } catch (err) {
          res.status(500).json({ error: (err as Error).message });
          return;
        }
      }

      if (duplicateId) {
        const errorMessage = aggregateIssues(issues);
        try {
          await updateStagingRow(supabase, row.id, {
            status: 'error',
            normalized_payload: null,
            error_message: errorMessage,
            duplicate_of_patient_id: duplicateId,
            // validated_at was already set previously; keep it as-is.
          });
        } catch (err) {
          res.status(500).json({ error: (err as Error).message });
        }
      } else {
        rowsReadyForInsert.push({
          rowId: row.id,
          payload: row.normalized_payload,
          errorMessage: row.error_message,
        });
      }
    }
  }

  for (const item of rowsReadyForInsert) {
    try {
      await insertPatient(supabase, item.payload);
      await updateStagingRow(supabase, item.rowId, {
        status: 'imported',
        imported_at: nowIso(),
        error_message: item.errorMessage ?? null,
      });
    } catch (err) {
      const message = (err as Error).message;
      await updateStagingRow(supabase, item.rowId, {
        status: 'error',
        error_message: item.errorMessage
          ? `${item.errorMessage}; Insert failed: ${message}`
          : `Insert failed: ${message}`,
      });
    }
  }

  try {
    const [totalRows, importedRows, errorRows] = await Promise.all([
      countByStatus(supabase, jobId),
      countByStatus(supabase, jobId, 'imported'),
      countByStatus(supabase, jobId, 'error'),
    ]);

    // Job-level status semantics (aligned with import_jobs_status_check):
    // - completed: at least one row imported (even if some errored)
    // - failed: no rows imported and at least one error
    // - pending/processing: handled at job creation / UI level
    let nextStatus: 'completed' | 'failed' = 'completed';
    let jobErrorMessage: string | null = null;

    if (importedRows === 0 && errorRows > 0) {
      nextStatus = 'failed';
      jobErrorMessage = 'All rows failed to import.';
    } else if (errorRows > 0) {
      // Completed with errors: some rows imported, some failed.
      nextStatus = 'completed';
      jobErrorMessage = 'Some rows failed to import.';
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
      imported_rows: importedRows,
      error_rows: errorRows,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
