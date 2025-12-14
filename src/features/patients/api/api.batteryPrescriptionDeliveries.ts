// src/features/patients/api/api.batteryPrescriptionDeliveries.ts
// Summary: CRUD helpers for battery_prescription_deliveries.
// v1.1:
// - Aligns column names with DB schema (qty_boxes/qty_packs/qty_units).
// - Allows battery_type to be stored as text (required by DB); normalizes/validates it.
// - Uses explicit Return=representation to keep types accurate.
// - Actionable error payloads; no unsafe casts from error arrays.
//
// NOTE:
// - DB schema (per your SQL):
//   battery_type (text, NOT NULL), qty_boxes, qty_packs, qty_units, delivered_at, prescription_no, note, created_at
// - created_by / brand are NOT present in the SQL you posted. If you need them, add columns in DB.
// - This file assumes RLS requires org_id to be provided.

import { supabaseClient } from '../../../utils/supabaseClient';
import type {
  BatteryLineDraft,
  BatteryPrescriptionDeliveryRow,
  CreateBatteryPrescriptionDeliveryInput,
} from '../types';

function safeTrim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/\D/g, ''));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function qtyTotal(line: BatteryLineDraft): number {
  const q = line.quantity ?? { box: 0, pack: 0, unit: 0 };
  const box = Number.isFinite(q.box) ? q.box : 0;
  const pack = Number.isFinite(q.pack) ? q.pack : 0;
  const unit = Number.isFinite(q.unit) ? q.unit : 0;
  return box + pack + unit;
}

function normalizeBatteryType(raw: BatteryLineDraft['batteryType']): string {
  // UI restricts to '10' | '312' | '13' | '675' but keep it resilient.
  const v = safeTrim(raw);
  if (!v) return '';
  return v;
}

function normalizeLine(line: BatteryLineDraft) {
  const q = line.quantity ?? { box: 0, pack: 0, unit: 0 };
  return {
    battery_type: normalizeBatteryType(line.batteryType), // required by DB
    // DB columns are plural:
    qty_boxes: clampInt(q.box, 0, 999),
    qty_packs: clampInt(q.pack, 0, 999),
    qty_units: clampInt(q.unit, 0, 999),
  };
}

/**
 * Insert battery prescription delivery rows (one row per line with qty > 0).
 * Throws on DB error to surface actionable feedback.
 */
export async function createBatteryPrescriptionDeliveries(params: {
  orgId: string;
  input: CreateBatteryPrescriptionDeliveryInput;
}): Promise<void> {
  const { orgId, input } = params;

  const org_id = safeTrim(orgId);
  if (!org_id) {
    throw new Error('BATTERY_DELIVERY_ORG_ID: orgId is required.');
  }

  const patient_id = safeTrim(input.patientId);
  if (!patient_id) {
    throw new Error('BATTERY_DELIVERY_PATIENT_ID: patientId is required.');
  }

  const delivered_at = safeTrim(input.deliveredAt) || new Date().toISOString();
  const prescription_no = safeTrim(input.prescriptionNo) || null;
  const note = safeTrim(input.note) || null;

  const lines = (input.lines ?? []).filter((l) => qtyTotal(l) > 0);
  if (lines.length === 0) return;

  const rows = lines.map((line) => {
    const n = normalizeLine(line);

    if (!n.battery_type) {
      throw new Error('BATTERY_DELIVERY_BATTERY_TYPE: batteryType cannot be empty.');
    }

    return {
      org_id,
      patient_id,
      battery_type: n.battery_type,
      qty_boxes: n.qty_boxes,
      qty_packs: n.qty_packs,
      qty_units: n.qty_units,
      delivered_at,
      prescription_no,
      note,
      // IMPORTANT: Do NOT send brand/created_by unless DB has those columns.
    };
  });

  const { error } = await supabaseClient
    .from('battery_prescription_deliveries')
    .insert(rows);

  if (error) {
    console.error('BATTERY_DELIVERIES_INSERT_FAILED:', {
      org_id,
      patient_id,
      delivered_at,
      rows,
      error,
    });
    throw new Error('BATTERY_DELIVERIES_INSERT_FAILED: ' + error.message);
  }
}

/**
 * List deliveries for a given patient (latest first).
 */
export async function fetchBatteryPrescriptionDeliveriesByPatient(
  patientId: string,
): Promise<BatteryPrescriptionDeliveryRow[]> {
  const patient_id = safeTrim(patientId);
  if (!patient_id) return [];

  const { data, error } = await supabaseClient
    .from('battery_prescription_deliveries')
    .select(
      [
        'id',
        'org_id',
        'patient_id',
        'battery_type',
        'qty_boxes',
        'qty_packs',
        'qty_units',
        'delivered_at',
        'prescription_no',
        'note',
        'created_at',
        // NOTE: brand/created_by are not selected because they are not in your SQL schema.
      ].join(', '),
    )
    .eq('patient_id', patient_id)
    .order('delivered_at', { ascending: false });

  if (error) {
    console.error('BATTERY_DELIVERIES_FETCH_FAILED:', { patient_id, error });
    throw error;
  }

  return (data ?? []) as BatteryPrescriptionDeliveryRow[];
}
