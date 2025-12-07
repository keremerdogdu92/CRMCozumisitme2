// src/features/patients/import/api.jobs.ts
// Client-side helpers to create patients import jobs and push CSV rows into staging.
import { supabaseClient } from '../../../utils/supabaseClient';
import type {
  PatientsImportRow,
  PatientsImportStatusSummary,
} from './types';

const MAX_BATCH_SIZE = 200;

async function getOrgContext(): Promise<{ orgId: string; userId: string }> {
  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();
  if (userError) {
    throw new Error('Failed to get current user: ' + userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('User is not authenticated.');
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    throw new Error('Failed to load profile: ' + profileError.message);
  }
  if (!profile?.org_id) {
    throw new Error('Profile org_id is missing.');
  }

  return { orgId: profile.org_id as string, userId: user.id };
}

export async function createPatientsImportJob(
  fileName: string,
  totalRows: number,
): Promise<{ jobId: string; orgId: string }> {
  const { orgId, userId } = await getOrgContext();

  const { data, error } = await supabaseClient
    .from('import_jobs')
    .insert({
      org_id: orgId,
      target_entity: 'patients',
      status: 'processing',
      source_filename: fileName || null,
      row_count: totalRows,
      created_by: userId,
    })
    .select('id, org_id')
    .single();

  if (error) {
    throw new Error('Failed to create import job: ' + error.message);
  }

  return { jobId: (data as any).id as string, orgId: (data as any).org_id };
}

export async function insertPatientsImportRows(
  jobId: string,
  orgId: string,
  rows: Array<{ rowIndex: number; rawRow: Record<string, string> }>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += MAX_BATCH_SIZE) {
    const batch = rows.slice(i, i + MAX_BATCH_SIZE);
    const payload = batch.map((row) => ({
      org_id: orgId,
      job_id: jobId,
      row_index: row.rowIndex,
      raw_row: row.rawRow,
      status: 'pending' as const,
      normalized_payload: null,
      error_message: null,
      duplicate_of_patient_id: null,
    }));

    const { error } = await supabaseClient
      .from('patients_import_rows')
      .insert(payload);

    if (error) {
      throw new Error(
        `Failed to insert import rows (batch starting at ${i + 1}): ` +
          error.message,
      );
    }
  }
}

async function countRows(
  jobId: string,
  filters: Record<string, any>,
): Promise<number> {
  let query = supabaseClient
    .from('patients_import_rows')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId);

  Object.entries(filters).forEach(([key, value]) => {
    if (value === null) {
      query = query.is(key, null);
    } else {
      query = query.eq(key, value);
    }
  });

  const { count, error } = await query;
  if (error) {
    throw new Error('Failed to count rows: ' + error.message);
  }
  return count ?? 0;
}

export async function getPatientsImportJobSummary(
  jobId: string,
): Promise<PatientsImportStatusSummary> {
  const [totalRows, importedRows, errorRows, validatedRows, warningRows] =
    await Promise.all([
      countRows(jobId, {}),
      countRows(jobId, { status: 'imported' }),
      countRows(jobId, { status: 'error' }),
      countRows(jobId, { status: 'validated' }),
      (async () => {
        const { count, error } = await supabaseClient
          .from('patients_import_rows')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId)
          .eq('status', 'validated')
          .not('error_message', 'is', null);
        if (error) {
          throw new Error('Failed to count warning rows: ' + error.message);
        }
        return count ?? 0;
      })(),
    ]);

  return {
    jobId,
    totalRows,
    importedRows,
    errorRows,
    validatedRows,
    warningRows,
  };
}
