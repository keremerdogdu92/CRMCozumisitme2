// api/legacy-patient-devices-import-processor.ts
// Summary: Serverless processor for LEGACY patient-device CSV imports.
// Phase 1: validates staging rows (patients_legacy_devices_import_rows),
// links them to patients by patient_national_id, and updates row/job status.
// Phase 2: for validated rows, creates/reuses devices in `public.devices` and
// inserts patient-device relations in `public.patient_devices`, then marks
// staging rows as imported and updates job summary.

import { createClient } from '@supabase/supabase-js';

// ------------------------
// Local types
// ------------------------

type LegacyDeviceImportIssue = {
  row_index: number;
  field: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
};

type LegacyDeviceImportSide = 'R' | 'L' | 'Tek' | 'Çift';

type LegacyDeviceImportNormalizedPayload = {
  org_id: string;
  patient_national_id: string;
  device_brand: string;
  device_model: string;
  ear_side: LegacyDeviceImportSide;
  serial_no: string | null;
  sold_at: string | null; // ISO string (T00:00:00.000Z) or null
  device_price: number | null; // total legacy price for this row (device(s) + accessories)
};

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
// Normalization helpers
// ------------------------

function normalizeString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function normalizeNumber(value: unknown): number | null {
  if (value == null) return null;
  const s = String(value).replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDateLike(
  raw: unknown,
): { value: string | null; invalid: boolean } {
  if (raw == null) return { value: null, invalid: false };
  const trimmed = String(raw).trim();
  if (!trimmed) return { value: null, invalid: false };

  // yyyy-mm-dd
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const [_, y, m, d] = isoMatch;
    return { value: `${y}-${m}-${d}T00:00:00.000Z`, invalid: false };
  }

  // dd.mm.yyyy
  const dotMatch = /^(\d{1,2})[.](\d{1,2})[.](\d{4})$/.exec(trimmed);
  if (dotMatch) {
    const day = dotMatch[1].padStart(2, '0');
    const month = dotMatch[2].padStart(2, '0');
    const year = dotMatch[3];
    return { value: `${year}-${month}-${day}T00:00:00.000Z`, invalid: false };
  }

  return { value: null, invalid: true };
}

function normalizeEarSide(
  value: unknown,
): { value: LegacyDeviceImportSide | null; error?: string } {
  if (value == null) {
    return { value: null, error: 'ear_side is required.' };
  }

  const trimmed = String(value).trim().toLowerCase();

  if (['r', 'sağ', 'sag', 'right'].includes(trimmed)) {
    return { value: 'R' };
  }
  if (['l', 'sol', 'left'].includes(trimmed)) {
    return { value: 'L' };
  }
  if (['tek', 'single'].includes(trimmed)) {
    return { value: 'Tek' };
  }
  if (['çift', 'cift', 'pair', 'both'].includes(trimmed)) {
    return { value: 'Çift' };
  }

  return {
    value: null,
    error: 'Invalid ear_side. Allowed: R, L, Tek, Çift.',
  };
}

function normalizeDevicePrice(
  value: unknown,
): { value: number | null; error?: string } {
  if (value == null) return { value: null };
  const n = normalizeNumber(value);
  if (n == null) {
    return {
      value: null,
      error: 'device_price is invalid. Expected a numeric value.',
    };
  }
  return { value: n };
}

// ------------------------
// Row-level validation
// ------------------------

function validateLegacyDeviceRow(params: {
  rawRow: Record<string, any>;
  orgId: string;
  rowIndex: number;
}): {
  normalized: LegacyDeviceImportNormalizedPayload | null;
  issues: LegacyDeviceImportIssue[];
} {
  const { rawRow, orgId, rowIndex } = params;
  const issues: LegacyDeviceImportIssue[] = [];

  const patientNationalIdRaw =
    normalizeString(rawRow.patient_national_id) ??
    normalizeString(rawRow['patient_national_id']);
  const deviceBrandRaw =
    normalizeString(rawRow.device_brand) ??
    normalizeString(rawRow['device_brand']);
  const deviceModelRaw =
    normalizeString(rawRow.device_model) ??
    normalizeString(rawRow['device_model']);
  const earSideRaw = rawRow.ear_side ?? rawRow['ear_side'];
  const serialNoRaw =
    normalizeString(rawRow.serial_no) ?? normalizeString(rawRow['serial_no']);
  const soldAtRaw = rawRow.sold_at ?? rawRow['sold_at'];
  const devicePriceRaw = rawRow.device_price ?? rawRow['device_price'];

  // 1) patient_national_id (required, 11 digits)
  if (!patientNationalIdRaw) {
    issues.push({
      row_index: rowIndex,
      field: 'patient_national_id',
      severity: 'error',
      message: 'patient_national_id is required.',
    });
  } else if (!/^\d{11}$/.test(patientNationalIdRaw)) {
    issues.push({
      row_index: rowIndex,
      field: 'patient_national_id',
      severity: 'error',
      message: 'patient_national_id must be 11 digits.',
    });
  }

  // 2) brand (required)
  if (!deviceBrandRaw) {
    issues.push({
      row_index: rowIndex,
      field: 'device_brand',
      severity: 'error',
      message: 'device_brand is required.',
    });
  }

  // 3) model (required)
  if (!deviceModelRaw) {
    issues.push({
      row_index: rowIndex,
      field: 'device_model',
      severity: 'error',
      message: 'device_model is required.',
    });
  }

  // 4) ear_side (required)
  const earSideResult = normalizeEarSide(earSideRaw);
  if (earSideResult.error) {
    issues.push({
      row_index: rowIndex,
      field: 'ear_side',
      severity: 'error',
      message: earSideResult.error,
    });
  }

  // 5) serial_no (optional)
  const serialNo = serialNoRaw ?? null;

  // 6) sold_at (optional, warning if invalid)
  const soldAtResult = parseDateLike(soldAtRaw);
  if (soldAtResult.invalid) {
    issues.push({
      row_index: rowIndex,
      field: 'sold_at',
      severity: 'warning',
      message: 'sold_at could not be parsed; skipped.',
    });
  }

  // 7) device_price (optional, warning if invalid)
  const devicePriceResult = normalizeDevicePrice(devicePriceRaw);
  if (devicePriceResult.error) {
    issues.push({
      row_index: rowIndex,
      field: 'device_price',
      severity: 'warning',
      message: devicePriceResult.error,
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  if (hasErrors) {
    return { normalized: null, issues };
  }

  const normalized: LegacyDeviceImportNormalizedPayload = {
    org_id: orgId,
    patient_national_id: patientNationalIdRaw as string,
    device_brand: deviceBrandRaw as string,
    device_model: deviceModelRaw as string,
    ear_side: earSideResult.value as LegacyDeviceImportSide,
    serial_no: serialNo,
    sold_at: soldAtResult.value,
    device_price: devicePriceResult.value,
  };

  return { normalized, issues };
}

// ------------------------
// Supabase helpers (staging)
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

async function fetchLegacyValidatedRowsForImport(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  jobId: string,
): Promise<LegacyDeviceStagingRow[]> {
  const { data, error } = await supabase
    .from('patients_legacy_devices_import_rows')
    .select(
      'id, org_id, job_id, row_index, raw_row, normalized_payload, status, error_message, duplicate_of_device_id, created_at, validated_at, imported_at',
    )
    .eq('job_id', jobId)
    .eq('status', 'validated')
    .is('imported_at', null)
    .order('row_index', { ascending: true });

  if (error) {
    throw new Error(
      'Failed to load validated legacy device rows for import: ' +
        error.message,
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
 * Validation helper: check if a patient exists for given national_id + org_id.
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

/**
 * Import helper: fetch the single patient id (assumes Phase 1 already validated uniqueness).
 */
async function fetchSinglePatientId(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  orgId: string,
  nationalId: string,
): Promise<{ status: 'ok'; id: string } | { status: 'missing' | 'multiple' }> {
  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('org_id', orgId)
    .eq('national_id', nationalId);

  if (error) {
    throw new Error(
      `Failed to fetch patient id for national_id=${nationalId}: ${error.message}`,
    );
  }

  const rows = (data ?? []) as { id: string }[];
  if (rows.length === 0) return { status: 'missing' };
  if (rows.length > 1) return { status: 'multiple' };
  return { status: 'ok', id: rows[0].id };
}

// ------------------------
// Supabase helpers (devices & patient_devices)
// ------------------------

async function findDeviceIdBySerial(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  orgId: string,
  serial: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('devices')
    .select('id')
    .eq('org_id', orgId)
    .eq('serial', serial)
    .limit(1);

  if (error) {
    throw new Error(
      `Failed to lookup device by serial=${serial}: ${error.message}`,
    );
  }

  const rows = (data ?? []) as { id: string }[];
  if (!rows.length) return null;
  return rows[0].id;
}

async function insertDeviceRowFromLegacy(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  payload: LegacyDeviceImportNormalizedPayload,
  serialOverride: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from('devices')
    .insert({
      org_id: payload.org_id,
      brand: payload.device_brand,
      model: payload.device_model,
      barcode: null,
      serial: serialOverride,
      status: 'sold', // legacy import are already sold/assigned devices
      hold_patient_id: null,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(
      `Failed to insert device for legacy row (patient_national_id=${payload.patient_national_id}): ${error.message}`,
    );
  }

  return (data as { id: string }).id;
}

async function upsertDeviceFromLegacyRow(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  payload: LegacyDeviceImportNormalizedPayload,
  options: { reuseBySerial: boolean; serialOverride: string | null },
): Promise<string> {
  const serial = options.serialOverride;

  // If we have a serial and reuse is allowed, attempt to find existing device.
  if (options.reuseBySerial && serial) {
    const existingId = await findDeviceIdBySerial(
      supabase,
      payload.org_id,
      serial,
    );
    if (existingId) {
      return existingId;
    }
  }

  // Otherwise create a new device row.
  return insertDeviceRowFromLegacy(supabase, payload, serial);
}

async function insertPatientDevicesRows(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  rows: {
    org_id: string;
    patient_id: string;
    device_id: string;
    side: string | null;
    assigned_at: string;
    price: number | null;
  }[],
): Promise<void> {
  if (!rows.length) return;

  const { error } = await supabase.from('patient_devices').insert(
    rows.map((r) => ({
      org_id: r.org_id,
      patient_id: r.patient_id,
      device_id: r.device_id,
      side: r.side,
      price: r.price, // Phase 2: we intentionally keep this NULL (per-row pricing later if needed).
      assigned_at: r.assigned_at,
      unassigned_at: null,
      // archive_code is handled by trigger trg_patient_devices_archive
    })),
  );

  if (error) {
    throw new Error(
      'Failed to insert patient_devices rows for legacy import: ' +
        error.message,
    );
  }
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

    // ------------------------
    // Phase 1: validation + patient existence check.
    // ------------------------
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

    // ------------------------
    // Phase 2: import validated rows into devices + patient_devices.
    // ------------------------

    let importedRowsCount = 0;
    let importErrorRowsCount = 0;

    let importCandidates: LegacyDeviceStagingRow[] = [];
    try {
      importCandidates = await fetchLegacyValidatedRowsForImport(
        supabase,
        jobId,
      );
    } catch (err) {
      console.error('Failed to fetch validated rows for import:', err);
      res.status(500).json({ error: (err as Error).message });
      return;
    }

    for (const row of importCandidates) {
      const normalized = row.normalized_payload;
      if (!normalized) {
        // Defensive: should not happen for status=validated, but mark as error if it does.
        importErrorRowsCount += 1;
        try {
          await updateLegacyStagingRow(supabase, row.id, {
            status: 'error',
            error_message:
              'Validated row missing normalized_payload; cannot import.',
            normalized_payload: null,
          });
        } catch (err) {
          console.error(
            'Failed to mark malformed validated row as error:',
            err,
          );
          res.status(500).json({ error: (err as Error).message });
          return;
        }
        continue;
      }

      try {
        // 1) Resolve patient id (single row expected).
        const patientLookup = await fetchSinglePatientId(
          supabase,
          normalized.org_id,
          normalized.patient_national_id,
        );

        if (patientLookup.status !== 'ok') {
          importErrorRowsCount += 1;
          const msg =
            patientLookup.status === 'missing'
              ? 'No patient found for this national_id in this organization at import time.'
              : 'Multiple patients found for this national_id in this organization at import time.';
          await updateLegacyStagingRow(supabase, row.id, {
            status: 'error',
            error_message: msg,
            normalized_payload: null,
          });
          continue;
        }

        const patientId = patientLookup.id;

        // 2) Decide device(s) and side(s) for this row.
        const sides: (string | null)[] =
          normalized.ear_side === 'Çift'
            ? ['left', 'right']
            : normalized.ear_side === 'R'
            ? ['right']
            : normalized.ear_side === 'L'
            ? ['left']
            : [null]; // 'Tek' → side is unknown / not tracked

        const deviceIds: string[] = [];

        if (normalized.ear_side === 'Çift') {
          // Pair case: two devices and two patient_devices.
          // First device: reuse by serial if available.
          const firstDeviceId = await upsertDeviceFromLegacyRow(supabase, normalized, {
            reuseBySerial: true,
            serialOverride: normalized.serial_no,
          });
          deviceIds.push(firstDeviceId);

          // Second device: always create a new one.
          // To avoid unique(serial) conflicts, second device uses NULL serial
          // when the legacy row only had a single serial.
          const secondDeviceId = await upsertDeviceFromLegacyRow(
            supabase,
            normalized,
            {
              reuseBySerial: false,
              serialOverride: normalized.serial_no ? null : null,
            },
          );
          deviceIds.push(secondDeviceId);
        } else {
          // Single device case (R, L, Tek)
          const deviceId = await upsertDeviceFromLegacyRow(supabase, normalized, {
            reuseBySerial: true,
            serialOverride: normalized.serial_no,
          });
          deviceIds.push(deviceId);
        }

        if (deviceIds.length !== sides.length) {
          throw new Error(
            `Internal error: deviceIds length (${deviceIds.length}) does not match sides length (${sides.length}) for row_index=${row.row_index}.`,
          );
        }

        // 3) Build patient_devices rows.
        const assignedAt = normalized.sold_at ?? nowIso();
        const patientDeviceRows = sides.map((side, index) => ({
          org_id: normalized.org_id,
          patient_id: patientId,
          device_id: deviceIds[index],
          side,
          price: null, // Phase 2: we are not splitting legacy total price per device.
          assigned_at: assignedAt,
        }));

        await insertPatientDevicesRows(supabase, patientDeviceRows);

        // 4) Mark staging row as imported.
        await updateLegacyStagingRow(supabase, row.id, {
          status: 'imported',
          imported_at: nowIso(),
          // keep normalized_payload for traceability; do not clear it.
        });

        importedRowsCount += 1;
      } catch (err) {
        console.error(
          `Import failed for legacy device row id=${row.id}, row_index=${row.row_index}:`,
          err,
        );
        importErrorRowsCount += 1;

        try {
          await updateLegacyStagingRow(supabase, row.id, {
            status: 'error',
            error_message:
              (row.error_message ? row.error_message + '; ' : '') +
              'Import failed for this row. See server logs for details.',
            normalized_payload: null,
          });
        } catch (updateErr) {
          console.error(
            'Failed to update staging row to error after import failure:',
            updateErr,
          );
          res.status(500).json({ error: (updateErr as Error).message });
          return;
        }
      }
    }

    // ------------------------
    // Job summary (after validation + import).
    // ------------------------
    try {
      const [totalRows, validatedRows, errorRows, importedRowsInDb] =
        await Promise.all([
          countLegacyRowsByStatus(supabase, jobId),
          countLegacyRowsByStatus(supabase, jobId, 'validated'),
          countLegacyRowsByStatus(supabase, jobId, 'error'),
          countLegacyRowsByStatus(supabase, jobId, 'imported'),
        ]);

      // Prefer DB-derived imported count, but keep the in-process counter for response clarity.
      const importedRowsFinal = importedRowsInDb;

      let nextStatus: 'completed' | 'failed' = 'completed';
      let jobErrorMessage: string | null = null;

      if (importedRowsFinal === 0 && errorRows > 0) {
        nextStatus = 'failed';
        jobErrorMessage =
          'All legacy device rows failed validation or import. No devices were imported.';
      } else if (errorRows > 0 || validatedRows > 0) {
        // Some rows failed or are still stuck in validated state.
        nextStatus = 'completed';
        jobErrorMessage =
          'Legacy devices import finished with partial errors. Some rows failed validation or import.';
      }

      await supabase
        .from('import_jobs')
        .update({
          status: nextStatus,
          finished_at: nowIso(),
          error_count: errorRows,
          row_count: totalRows,
          imported_rows: importedRowsFinal,
          error_message: jobErrorMessage,
        })
        .eq('id', jobId);

      res.status(200).json({
        job_id: jobId,
        total_rows: totalRows,
        validated_rows: validatedRows,
        error_rows: errorRows,
        imported_rows: importedRowsFinal,
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
