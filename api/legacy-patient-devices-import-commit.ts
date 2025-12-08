// api/legacy-patient-devices-import-commit.ts
// Summary: Phase 2 processor for LEGACY patient-device CSV imports.
// Takes validated rows from patients_legacy_devices_import_rows
// and creates patient_devices records linked to real patients.
//
// Usage (POST):
//   /api/legacy-patient-devices-import-commit
//   body: { job_id: "<import_jobs.id>" }

import { createClient } from '@supabase/supabase-js';

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

type LegacyDeviceImportSide = 'R' | 'L' | 'Tek' | 'Çift';

type LegacyDeviceImportNormalizedPayload = {
  org_id: string;
  patient_national_id: string;
  device_brand: string;
  device_model: string;
  ear_side: LegacyDeviceImportSide;
  serial_no: string | null;
  sold_at: string | null;
  device_price: number | null;
};

type LegacyDeviceStagingRow = {
  id: string;
  org_id: string;
  job_id: string;
  row_index: number;
  normalized_payload: LegacyDeviceImportNormalizedPayload | null;
  status: 'pending' | 'validated' | 'error' | 'imported';
};

type ImportJobRow = {
  id: string;
  org_id: string;
  target_entity: string;
  status: string;
};

declare const process: {
  env: {
    SUPABASE_URL?: string;
    VITE_SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    SUPABASE_SERVICE_ROLE?: string;
    [key: string]: string | undefined;
  };
};

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

async function loadJob(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  jobId: string,
): Promise<ImportJobRow> {
  const { data, error } = await supabase
    .from('import_jobs')
    .select('id, org_id, target_entity, status')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    throw new Error('Failed to load import job: ' + error.message);
  }
  if (!data) {
    throw new Error('Import job not found for id=' + jobId);
  }

  return data as ImportJobRow;
}

async function loadValidatedRows(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  jobId: string,
): Promise<LegacyDeviceStagingRow[]> {
  const { data, error } = await supabase
    .from('patients_legacy_devices_import_rows')
    .select('id, org_id, job_id, row_index, normalized_payload, status')
    .eq('job_id', jobId)
    .eq('status', 'validated')
    .order('row_index', { ascending: true });

  if (error) {
    throw new Error(
      'Failed to load validated legacy device rows: ' + error.message,
    );
  }

  return (data ?? []) as LegacyDeviceStagingRow[];
}

async function findPatientIdByNationalId(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  orgId: string,
  nationalId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('org_id', orgId)
    .eq('national_id', nationalId);

  if (error) {
    throw new Error(
      `Failed to find patient for national_id=${nationalId}: ${error.message}`,
    );
  }

  const rows = (data ?? []) as { id: string }[];
  if (rows.length !== 1) {
    return null;
  }
  return rows[0].id;
}

async function insertPatientDevice(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  params: {
    orgId: string;
    patientId: string;
    payload: LegacyDeviceImportNormalizedPayload;
    jobId: string;
    stagingRowId: string;
  },
): Promise<void> {
  const { orgId, patientId, payload, jobId, stagingRowId } = params;

  const { error } = await supabase.from('patient_devices').insert({
    org_id: orgId,
    patient_id: patientId,
    brand: payload.device_brand,
    model: payload.device_model,
    ear_side: payload.ear_side,
    serial_no: payload.serial_no,
    sold_at: payload.sold_at ? payload.sold_at.substring(0, 10) : null, // date only
    legacy_price_total: payload.device_price,
    is_legacy: true,
    legacy_import_job_id: jobId,
    legacy_row_id: stagingRowId,
  });

  if (error) {
    throw new Error('Failed to insert patient_device: ' + error.message);
  }
}

async function markRowImported(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  rowId: string,
): Promise<void> {
  const { error } = await supabase
    .from('patients_legacy_devices_import_rows')
    .update({
      status: 'imported',
      imported_at: nowIso(),
    })
    .eq('id', rowId);

  if (error) {
    throw new Error(
      'Failed to update legacy device staging row to imported: ' +
        error.message,
    );
  }
}

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

    const supabase = createAdminSupabaseClient();

    // 1) Job kontrolü
    const job = await loadJob(supabase, jobId);
    if (job.target_entity !== 'legacy_patient_devices') {
      res.status(400).json({
        error:
          'Import job target_entity is not legacy_patient_devices (got ' +
          job.target_entity +
          ').',
      });
      return;
    }

    // 2) Validated satırları çek
    const rows = await loadValidatedRows(supabase, jobId);
    if (!rows.length) {
      res.status(200).json({
        job_id: jobId,
        imported_rows: 0,
        message: 'No validated rows to import.',
      });
      return;
    }

    let importedCount = 0;
    const errors: { row_index: number; message: string }[] = [];

    // 3) Her satır için hasta bul ve cihaz kaydet
    for (const row of rows) {
      try {
        let payload = row.normalized_payload;

        // Supabase JSONB bazen string olarak dönebilir; korumalı şekilde parse et.
        if (payload && typeof payload === 'string') {
          payload = JSON.parse(payload) as LegacyDeviceImportNormalizedPayload;
        }

        if (!payload) {
          errors.push({
            row_index: row.row_index,
            message: 'Missing normalized_payload.',
          });
          continue;
        }

        const patientId = await findPatientIdByNationalId(
          supabase,
          row.org_id,
          payload.patient_national_id,
        );

        if (!patientId) {
          errors.push({
            row_index: row.row_index,
            message:
              'Patient not found or multiple patients for this national_id.',
          });
          continue;
        }

        // Tek satır = tek cihaz kaydı. (Çift/Tek bilgisi ear_side alanında duruyor.)
        await insertPatientDevice(supabase, {
          orgId: row.org_id,
          patientId,
          payload,
          jobId,
          stagingRowId: row.id,
        });

        await markRowImported(supabase, row.id);
        importedCount += 1;
      } catch (err) {
        console.error(
          'Failed to import legacy device row:',
          row.id,
          'error:',
          err,
        );
        errors.push({
          row_index: row.row_index,
          message: (err as Error).message,
        });
        // Diğer satırlara devam ediyoruz.
      }
    }

    // 4) import_jobs özetini güncelle
    const { error: jobUpdateError } = await supabase
      .from('import_jobs')
      .update({
        status: errors.length > 0 ? 'completed' : 'completed', // kısmi hata durumunu mesajla belirtiyoruz
        finished_at: nowIso(),
        error_count: errors.length,
        error_message:
          errors.length > 0
            ? 'Some legacy device rows failed to import. Check staging table.'
            : null,
      })
      .eq('id', jobId);

    if (jobUpdateError) {
      throw new Error(
        'Failed to update import_jobs summary: ' + jobUpdateError.message,
      );
    }

    res.status(200).json({
      job_id: jobId,
      imported_rows: importedCount,
      import_errors: errors,
    });
  } catch (err) {
    console.error(
      'Unhandled error in legacy-patient-devices-import-commit:',
      err,
    );
    res.status(500).json({ error: 'Unhandled server error.' });
  }
}
