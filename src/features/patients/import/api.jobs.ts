// src/features/patients/import/api.jobs.ts
// Summary: Client-side helpers to create import jobs, push CSV rows into staging,
// summarize statuses, and (v1) fetch error rows for both patients and legacy devices.

import { supabaseClient } from '../../../utils/supabaseClient';
import type {
  PatientsImportRow,
  PatientsImportStatusSummary,
  LegacyDevicesImportStatusSummary,
  LegacyDevicesImportRow,
  InventoryImportStatusSummary,
  InventoryImportRow,
} from './types';

const MAX_BATCH_SIZE = 200;

type ImportJobCreateRow = {
  id: string;
  org_id: string;
};

async function getOrgContext(): Promise<{ orgId: string; userId: string }> {
  // 1) Get current user
  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();
  if (userError) {
    throw new Error('Failed to get current user: ' + userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('User is not authenticated.');
  }

  // 2) Fetch profile row to resolve org_id
  const { data: profiles, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id, org_id')
    .eq('id', user.id);

  if (profileError) {
    throw new Error('Failed to load profile: ' + profileError.message);
  }

  if (!profiles || profiles.length === 0) {
    throw new Error(
      'Failed to load profile: no profile row found for current user. Please create a profile row in `profiles` for this user.',
    );
  }

  if (profiles.length > 1) {
    throw new Error(
      'Failed to load profile: multiple profile rows found for current user. Please ensure only one row exists in `profiles` for this user id.',
    );
  }

  const profile = profiles[0];
  if (!profile.org_id) {
    throw new Error('Profile org_id is missing.');
  }

  return { orgId: profile.org_id as string, userId: user.id };
}

// -----------------------------
// Patients import job helpers
// -----------------------------

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

  const row = data as ImportJobCreateRow;
  return { jobId: row.id, orgId: row.org_id };
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
  table: string,
  jobId: string,
  filters: Record<string, boolean | string | null>,
): Promise<number> {
  let query = supabaseClient
    .from(table)
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
  const table = 'patients_import_rows';

  const [totalRows, importedRows, errorRows, validatedRows, warningRows] =
    await Promise.all([
      countRows(table, jobId, {}),
      countRows(table, jobId, { status: 'imported' }),
      countRows(table, jobId, { status: 'error' }),
      countRows(table, jobId, { status: 'validated' }),
      (async () => {
        const { count, error } = await supabaseClient
          .from(table)
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

// -----------------------------
// Legacy patient devices import
// -----------------------------

export async function createLegacyDevicesImportJob(
  fileName: string,
  totalRows: number,
): Promise<{ jobId: string; orgId: string }> {
  const { orgId, userId } = await getOrgContext();

  const { data, error } = await supabaseClient
    .from('import_jobs')
    .insert({
      org_id: orgId,
      target_entity: 'legacy_patient_devices',
      status: 'processing',
      source_filename: fileName || null,
      row_count: totalRows,
      created_by: userId,
    })
    .select('id, org_id')
    .single();

  if (error) {
    throw new Error(
      'Failed to create legacy devices import job: ' + error.message,
    );
  }

  const row = data as ImportJobCreateRow;
  return { jobId: row.id, orgId: row.org_id };
}

export async function insertLegacyDevicesImportRows(
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
    }));

    const { error } = await supabaseClient
      .from('patients_legacy_devices_import_rows')
      .insert(payload);

    if (error) {
      throw new Error(
        `Failed to insert legacy device rows (batch starting at ${i + 1}): ` +
          error.message,
      );
    }
  }
}

export async function getLegacyDevicesImportJobSummary(
  jobId: string,
): Promise<LegacyDevicesImportStatusSummary> {
  const table = 'patients_legacy_devices_import_rows';

  const [totalRows, importedRows, errorRows, validatedRows, warningRows] =
    await Promise.all([
      countRows(table, jobId, {}),
      countRows(table, jobId, { status: 'imported' }),
      countRows(table, jobId, { status: 'error' }),
      countRows(table, jobId, { status: 'validated' }),
      (async () => {
        const { count, error } = await supabaseClient
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId)
          .eq('status', 'validated')
          .not('error_message', 'is', null);
        if (error) {
          throw new Error(
            'Failed to count legacy devices warning rows: ' + error.message,
          );
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

// -----------------------------
// Inventory import
// -----------------------------

export async function getInventoryImportJobSummary(
  jobId: string,
): Promise<InventoryImportStatusSummary> {
  const table = 'inventory_import_rows';

  const [totalRows, importedRows, errorRows, warningRows] = await Promise.all([
    countRows(table, jobId, {}),
    countRows(table, jobId, { valid: true }),
    countRows(table, jobId, { valid: false }),
    (async () => {
      const { count, error } = await supabaseClient
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('valid', true)
        .not('validation_error', 'is', null);
      if (error) {
        throw new Error(
          'Failed to count inventory import warning rows: ' + error.message,
        );
      }
      return count ?? 0;
    })(),
  ]);

  return {
    jobId,
    totalRows,
    importedRows,
    errorRows,
    validatedRows: importedRows,
    warningRows,
  };
}

// -----------------------------
// v1 Import Fix Center helpers
// -----------------------------

export async function fetchPatientsImportErrorRows(
  jobId: string,
): Promise<PatientsImportRow[]> {
  const { data, error } = await supabaseClient
    .from('patients_import_rows')
    .select(
      'id, org_id, job_id, row_index, raw_row, normalized_payload, status, error_message, duplicate_of_patient_id, created_at, validated_at, imported_at',
    )
    .eq('job_id', jobId)
    .eq('status', 'error')
    .order('row_index', { ascending: true });

  if (error) {
    throw new Error(
      'Failed to fetch patient import error rows: ' + error.message,
    );
  }

  return (data ?? []) as PatientsImportRow[];
}

export async function fetchLegacyDevicesImportErrorRows(
  jobId: string,
): Promise<LegacyDevicesImportRow[]> {
  const { data, error } = await supabaseClient
    .from('patients_legacy_devices_import_rows')
    .select(
      'id, org_id, job_id, row_index, raw_row, normalized_payload, status, error_message, created_at, validated_at, imported_at',
    )
    .eq('job_id', jobId)
    .eq('status', 'error')
    .order('row_index', { ascending: true });

  if (error) {
    throw new Error(
      'Failed to fetch legacy device import error rows: ' + error.message,
    );
  }

  return (data ?? []) as LegacyDevicesImportRow[];
}

export async function fetchInventoryImportErrorRows(
  jobId: string,
): Promise<InventoryImportRow[]> {
  const { data, error } = await supabaseClient
    .from('inventory_import_rows')
    .select(
      'id, job_id, row_index, raw_brand, raw_model, raw_item_type, raw_barcode, raw_serial_no, raw_status, raw_purchase_price, raw_list_price, raw_purchase_date, raw_notes, valid, validation_error, resolved_at, resolved_by, resolved_inventory_item_id, resolution_note',
    )
    .eq('job_id', jobId)
    .eq('valid', false)
    .is('resolved_at', null)
    .order('row_index', { ascending: true });

  if (error) {
    throw new Error(
      'Failed to fetch inventory import error rows: ' + error.message,
    );
  }

  return (data ?? []) as InventoryImportRow[];
}
