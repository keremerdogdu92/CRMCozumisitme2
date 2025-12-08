// api/patients-import-processor.ts
// Vercel serverless processor: validate staging rows, detect duplicates,
// insert patients, and update import_jobs.

import { createClient } from '@supabase/supabase-js';

// ------------------------
// Local types & validator
// (frontend'deki dosyalara bağımlılığı kaldırıyoruz)
// ------------------------

type PatientsImportIssue = {
  row_index: number;
  field: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  duplicate_of_patient_id?: string | null;
};

type PatientsImportNormalizedPayload = {
  org_id: string;
  full_name: string;
  phone: string | null;
  national_id: string | null;
  payment_method: string | null;
  sale_total: number | null;
  card_fee_rate: number | null;
  sgk_flag: boolean | null;
  sgk_prescription_received: boolean | null;
  sgk_recorded_to_system: boolean | null;
  sale_date: string | null;
};

// Basit normalizasyon yardımcıları
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

function normalizeBoolean(value: unknown): boolean | null {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  if (['1', 'true', 'evet', 'yes'].includes(s)) return true;
  if (['0', 'false', 'hayır', 'hayir', 'no'].includes(s)) return false;
  return null;
}

function normalizeDate(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  //  dd.mm.yyyy  veya  yyyy-mm-dd gibi basic formatları deneyelim
  const dotMatch = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dotMatch) {
    const [_, d, m, y] = dotMatch;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const dObj = new Date(iso);
    if (!Number.isNaN(dObj.getTime())) return dObj.toISOString();
  }

  const dObj = new Date(s);
  if (!Number.isNaN(dObj.getTime())) return dObj.toISOString();

  return null;
}

// Çok sert olmayan bir telefon normalizasyonu
function normalizePhone(value: unknown): string | null {
  if (value == null) return null;
  let s = String(value).replace(/[^\d+]/g, '');
  if (!s) return null;

  // Türkiye varsayımı: başta 0 ile geliyorsa kırpıp +90 ekleyelim
  if (s.startsWith('0') && !s.startsWith('+')) {
    s = '+90' + s.slice(1);
  }
  if (!s.startsWith('+') && s.length === 10) {
    s = '+90' + s;
  }

  return s;
}

function validatePatientsRow(params: {
  rawRow: Record<string, any>;
  orgId: string;
  rowIndex: number;
}): {
  normalized: PatientsImportNormalizedPayload | null;
  issues: PatientsImportIssue[];
} {
  const { rawRow, orgId, rowIndex } = params;
  const issues: PatientsImportIssue[] = [];

  const fullName =
    normalizeString(rawRow.full_name) ??
    normalizeString(rawRow.ad_soyad) ??
    normalizeString(rawRow['Ad Soyad']);

  const phone =
    normalizePhone(rawRow.phone) ?? normalizePhone(rawRow['Telefon']);

  const nationalId =
    normalizeString(rawRow.national_id) ??
    normalizeString(rawRow.tc_kimlik_no) ??
    normalizeString(rawRow['T.C. Kimlik No']);

  const paymentMethod =
    normalizeString(rawRow.payment_method) ??
    normalizeString(rawRow['Ödeme Şekli']);

  const saleTotal =
    normalizeNumber(rawRow.sale_total) ??
    normalizeNumber(rawRow.card_sale_total) ??
    normalizeNumber(rawRow['Toplam Satış Tutarı']);

  const cardFeeRate =
    normalizeNumber(rawRow.card_fee_rate) ??
    normalizeNumber(rawRow['Kart Komisyon Oranı']);

  const sgkFlag =
    normalizeBoolean(rawRow.sgk_flag) ??
    normalizeBoolean(rawRow['SGK Hastası']);

  const sgkPrescriptionReceived =
    normalizeBoolean(rawRow.sgk_prescription_received) ??
    normalizeBoolean(rawRow['Reçete Alındı']);

  const sgkRecordedToSystem =
    normalizeBoolean(rawRow.sgk_recorded_to_system) ??
    normalizeBoolean(rawRow['Sisteme İşlendi']);

  const saleDate =
    normalizeDate(rawRow.sale_date) ??
    normalizeDate(rawRow['Satış Tarihi']);

  // Zorunlu alan kontrolleri
  if (!fullName) {
    issues.push({
      row_index: rowIndex,
      field: 'full_name',
      severity: 'error',
      message: 'Ad Soyad zorunludur.',
    });
  }

  if (!phone && !nationalId) {
    issues.push({
      row_index: rowIndex,
      field: 'identity',
      severity: 'error',
      message: 'Telefon veya T.C. Kimlik No alanlarından en az biri zorunludur.',
    });
  }

  if (!paymentMethod) {
    issues.push({
      row_index: rowIndex,
      field: 'payment_method',
      severity: 'error',
      message: 'Ödeme Şekli zorunludur.',
    });
  }

  if (saleTotal == null) {
    issues.push({
      row_index: rowIndex,
      field: 'sale_total',
      severity: 'error',
      message: 'Toplam satış tutarı zorunludur.',
    });
  }

  // TCKN basic check
  if (nationalId && !/^\d{11}$/.test(nationalId)) {
    issues.push({
      row_index: rowIndex,
      field: 'national_id',
      severity: 'error',
      message: 'T.C. Kimlik No 11 haneli sayı olmalıdır.',
    });
  }

  const normalized: PatientsImportNormalizedPayload = {
    org_id: orgId,
    full_name: fullName ?? '',
    phone: phone ?? null,
    national_id: nationalId ?? null,
    payment_method: paymentMethod ?? null,
    sale_total: saleTotal,
    card_fee_rate: cardFeeRate,
    sgk_flag: sgkFlag,
    sgk_prescription_received: sgkPrescriptionReceived,
    sgk_recorded_to_system: sgkRecordedToSystem,
    sale_date: saleDate,
  };

  return {
    normalized,
    issues,
  };
}

// ------------------------
// API request/response typings
// ------------------------

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

// Minimal process declaration (sadece env için)
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
}): Promise<string | null> {
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

  return (data as { id: string } | null)?.id ?? null;
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

    let stagingRows: StagingRow[] = [];
    try {
      stagingRows = await fetchStagingRows(supabase, jobId);
    } catch (err) {
      console.error('Failed to fetch staging rows:', err);
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
            console.error('Duplicate check failed:', err);
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
          console.error('Update staging row failed:', err);
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
            console.error('Duplicate check (validated rows) failed:', err);
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
            });
          } catch (err) {
            console.error(
              'Update staging row (duplicate validated) failed:',
              err,
            );
            res.status(500).json({ error: (err as Error).message });
            return;
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
        console.error('Insert patient failed:', err);
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

      let nextStatus: 'completed' | 'failed' = 'completed';
      let jobErrorMessage: string | null = null;

      if (importedRows === 0 && errorRows > 0) {
        nextStatus = 'failed';
        jobErrorMessage = 'All rows failed to import.';
      } else if (errorRows > 0) {
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
      console.error('Final job status update failed:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  } catch (err) {
    console.error('Unhandled error in patients-import-processor:', err);
    res.status(500).json({ error: 'Unhandled server error.' });
  }
}
