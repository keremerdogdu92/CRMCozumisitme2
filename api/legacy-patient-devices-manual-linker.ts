// api/legacy-patient-devices-manual-linker.ts
// Summary: Serverless endpoint to manually fix a single legacy device staging row.
// It links the row to a specific patient_id and creates inventory_items +
// patient_devices records.
// Intended to be called from the Import Dashboard "Fix legacy device row" modal.

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

// Minimal process declaration (env only)
declare const process: {
  env: {
    SUPABASE_URL?: string;
    VITE_SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    SUPABASE_SERVICE_ROLE?: string;
    [key: string]: string | undefined;
  };
};

type LegacyEarSide = 'R' | 'L' | 'Çift';

type LegacyDeviceStagingRow = {
  id: string;
  org_id: string;
  job_id: string;
  row_index: number;
  raw_row: Record<string, any>;
  status: 'pending' | 'validated' | 'error' | 'imported';
  error_message: string | null;
  created_at: string;
  validated_at: string | null;
  imported_at: string | null;
};

type PatientSaleDateInfo = {
  id: string;
  org_id: string;
  created_at: string | null;
  invoice_issued_at: string | null;
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

function parseDateLike(raw: unknown): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // yyyy-mm-dd
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const [_, y, m, d] = isoMatch;
    return `${y}-${m}-${d}T00:00:00.000Z`;
  }

  // dd.mm.yyyy
  const dotMatch = /^(\d{1,2})[.](\d{1,2})[.](\d{4})$/.exec(trimmed);
  if (dotMatch) {
    const day = dotMatch[1].padStart(2, '0');
    const month = dotMatch[2].padStart(2, '0');
    const year = dotMatch[3];
    return `${year}-${month}-${day}T00:00:00.000Z`;
  }

  return null;
}

function normalizeEarSideForManual(value: unknown): LegacyEarSide | null {
  if (value == null) return null;
  const trimmed = String(value).trim().toLowerCase();

  if (['r', 'sağ', 'sag', 'right'].includes(trimmed)) return 'R';
  if (['l', 'sol', 'left'].includes(trimmed)) return 'L';
  if (['çift', 'cift', 'pair', 'both'].includes(trimmed)) return 'Çift';

  // NOTE: "Tek" is intentionally not supported here to force a clear side (R/L).
  return null;
}

/**
 * Tarih seçim kuralı:
 * 1) patients.invoice_issued_at
 * 2) patients.created_at
 * 3) stagingRow sold_at
 * 4) hiçbiri yoksa null
 */
function chooseEffectiveSoldAt(
  patient: PatientSaleDateInfo,
  stagingSoldAtIso: string | null,
): string | null {
  return (
    patient.invoice_issued_at ??
    patient.created_at ??
    stagingSoldAtIso ??
    null
  );
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const stagingRowId =
      (req.body &&
        typeof req.body.staging_row_id === 'string' &&
        req.body.staging_row_id) ||
      (typeof req.query.staging_row_id === 'string'
        ? req.query.staging_row_id
        : null);

    const patientId =
      (req.body &&
        typeof req.body.patient_id === 'string' &&
        req.body.patient_id) ||
      (typeof req.query.patient_id === 'string' ? req.query.patient_id : null);

    const earSideOverrideRaw =
      (req.body && req.body.ear_side) || req.query.ear_side;

    if (!stagingRowId) {
      res.status(400).json({ error: 'staging_row_id is required.' });
      return;
    }
    if (!patientId) {
      res.status(400).json({ error: 'patient_id is required.' });
      return;
    }

    const earSideOverride = normalizeEarSideForManual(earSideOverrideRaw);
    if (!earSideOverride) {
      res.status(400).json({
        error:
          'ear_side must be one of: R, L, Çift (Tek is not allowed in manual linker).',
      });
      return;
    }

    const supabase = createAdminSupabaseClient();

    // 1) Load staging row
    const { data: rows, error: rowError } = await supabase
      .from('patients_legacy_devices_import_rows')
      .select(
        'id, org_id, job_id, row_index, raw_row, status, error_message, created_at, validated_at, imported_at',
      )
      .eq('id', stagingRowId)
      .limit(1);

    if (rowError) {
      res.status(500).json({
        error:
          'Failed to load legacy device staging row: ' + rowError.message,
      });
      return;
    }

    if (!rows || rows.length === 0) {
      res.status(404).json({ error: 'Staging row not found.' });
      return;
    }

    const stagingRow = rows[0] as LegacyDeviceStagingRow;

    if (stagingRow.status === 'imported') {
      res.status(400).json({ error: 'This staging row is already imported.' });
      return;
    }

    // 2) Normalize raw_row (patient_national_id is ignored here)
    const rr = stagingRow.raw_row || {};

    const brand = normalizeString(rr.device_brand ?? rr.brand);
    const model = normalizeString(rr.device_model ?? rr.model);
    const serial = normalizeString(rr.serial_no ?? rr.serial);
    const soldAtIsoFromRow = parseDateLike(rr.sold_at);
    const linePrice = normalizeNumber(rr.device_price);

    if (!brand) {
      res.status(400).json({
        error:
          'device_brand is missing or empty. Please fix the CSV or staging row first.',
      });
      return;
    }
    if (!model) {
      res.status(400).json({
        error:
          'device_model is missing or empty. Please fix the CSV or staging row first.',
      });
      return;
    }

    // 3) Ensure patient belongs to the same org (safety) + tarih bilgileri
    const { data: patientRows, error: patientError } = await supabase
      .from('patients')
      .select('id, org_id, created_at, invoice_issued_at')
      .eq('id', patientId)
      .limit(1);

    if (patientError) {
      res.status(500).json({
        error:
          'Failed to load patient for manual link: ' + patientError.message,
      });
      return;
    }

    if (!patientRows || patientRows.length === 0) {
      res.status(400).json({
        error: 'Patient not found for given patient_id.',
      });
      return;
    }

    const patient = patientRows[0] as PatientSaleDateInfo;
    if (patient.org_id !== stagingRow.org_id) {
      res.status(400).json({
        error: 'Patient and staging row belong to different orgs.',
      });
      return;
    }

    const effectiveSoldAtIso = chooseEffectiveSoldAt(
      patient,
      soldAtIsoFromRow,
    );

    // 4) Insert inventory_items + patient_devices
    const insertedDeviceIds: string[] = [];

    const assignSideAndInsert = async (side: 'left' | 'right') => {
      // Create inventory_items row for this ear
      const { data: invData, error: invError } = await supabase
        .from('inventory_items')
        .insert({
          org_id: stagingRow.org_id,
          brand,
          model,
          item_type: 'hearing_aid', // legacy devices are treated as hearing aids
          barcode: null,
          serial_no: serial ?? null,
          ear_side: side === 'left' ? 'left' : 'right',
          status: 'sold',
          purchase_price: null,
          // Tarihsel cihazlar için tavsiye liste fiyatı elimizde yok;
          // eldeki device_price alanını list_price olarak kullanıyoruz ki
          // patient_list_with_device tarafında "Tavsiye Satış Toplamı"
          // tamamen boş kalmasın.
          list_price: linePrice ?? null,
          sold_patient_id: patientId,
          sold_at: effectiveSoldAtIso,
        })
        .select('id')
        .single();

      if (invError) {
        throw new Error(
          'Failed to insert inventory_item for legacy device: ' +
            invError.message,
        );
      }

      const inventoryItemId = (invData as any).id as string;
      insertedDeviceIds.push(inventoryItemId);

      const { error: linkError } = await supabase
        .from('patient_devices')
        .insert({
          org_id: stagingRow.org_id,
          patient_id: patientId,
          device_id: inventoryItemId,
          side,
          price: linePrice ?? null,
          // Archive code trigger will use assigned_at; hasta tarafındaki
          // satış tarihi varsa onu kullanıyoruz, yoksa bugünün tarihi.
          assigned_at: effectiveSoldAtIso ?? nowIso(),
          // archive_code is assumed to be generated by trigger
        });

      if (linkError) {
        throw new Error(
          'Failed to insert patient_devices link: ' + linkError.message,
        );
      }
    };

    try {
      if (earSideOverride === 'Çift') {
        await assignSideAndInsert('left');
        await assignSideAndInsert('right');
      } else if (earSideOverride === 'R') {
        await assignSideAndInsert('right');
      } else {
        await assignSideAndInsert('left');
      }
    } catch (innerErr) {
      console.error('Manual legacy device inserter failed:', innerErr);
      res.status(500).json({
        error:
          'Failed to create inventory_items / patient_devices records: ' +
          (innerErr as Error).message,
      });
      return;
    }

    // 5) Mark staging row as imported
    const { error: updateError } = await supabase
      .from('patients_legacy_devices_import_rows')
      .update({
        status: 'imported',
        imported_at: nowIso(),
        error_message: null,
      })
      .eq('id', stagingRow.id);

    if (updateError) {
      res.status(500).json({
        error:
          'Records created, but failed to update staging row: ' +
          updateError.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      staging_row_id: stagingRow.id,
      created_device_ids: insertedDeviceIds,
    });
  } catch (err) {
    console.error(
      'Unhandled error in legacy-patient-devices-manual-linker:',
      err,
    );
    res.status(500).json({ error: 'Unhandled server error.' });
  }
}
