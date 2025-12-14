// src/features/patients/api/api.batteryPrescriptionDeliveries.ts
// Summary: CRUD helpers for battery_prescription_deliveries.
// v1.0:
// - createBatteryPrescriptionDeliveries: inserts one row per BatteryLineDraft with qty > 0.
// - fetchBatteryPrescriptionDeliveriesByPatient: lists deliveries for a patient (latest first).
//
// NOTE:
// - Column names are assumed to be: battery_type, brand, qty_box, qty_pack, qty_unit,
//   delivered_at, prescription_no, note, created_by, org_id, patient_id.
// - If your DB uses different names, the error logs will show the failing payload.

import { supabaseClient } from '../../../utils/supabaseClient';
import type {
  BatteryLineDraft,
  BatteryPrescriptionDeliveryRow,
  CreateBatteryPrescriptionDeliveryInput,
} from '../types';

function safeTrim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function qtyTotal(line: BatteryLineDraft): number {
  const q = line.quantity ?? { box: 0, pack: 0, unit: 0 };
  const box = Number.isFinite(q.box) ? q.box : 0;
  const pack = Number.isFinite(q.pack) ? q.pack : 0;
  const unit = Number.isFinite(q.unit) ? q.unit : 0;
  return box + pack + unit;
}

function normalizeLine(line: BatteryLineDraft) {
  const q = line.quantity ?? { box: 0, pack: 0, unit: 0 };
  return {
    battery_type: safeTrim(line.batteryType) || null,
    brand: safeTrim(line.brand) || null,
    qty_box: Number.isFinite(q.box) ? Math.max(0, Math.trunc(q.box)) : 0,
    qty_pack: Number.isFinite(q.pack) ? Math.max(0, Math.trunc(q.pack)) : 0,
    qty_unit: Number.isFinite(q.unit) ? Math.max(0, Math.trunc(q.unit)) : 0,
  };
}

/**
 * Insert battery prescription delivery rows (one row per line).
 * Best-effort: throws on DB error to surface actionable feedback.
 */
export async function createBatteryPrescriptionDeliveries(params: {
  orgId: string;
  createdBy: string;
  input: CreateBatteryPrescriptionDeliveryInput;
}): Promise<void> {
  const { orgId, createdBy, input } = params;

  const patientId = safeTrim(input.patientId);
  if (!patientId) {
    throw new Error('BATTERY_DELIVERY_PATIENT_ID: patientId is required.');
  }

  const deliveredAt = safeTrim(input.deliveredAt) || new Date().toISOString();
  const prescriptionNo = safeTrim(input.prescriptionNo);
  const note = safeTrim(input.note);

  const lines = (input.lines ?? []).filter((l) => qtyTotal(l) > 0);
  if (lines.length === 0) return;

  const rows = lines.map((line) => {
    const n = normalizeLine(line);
    return {
      org_id: orgId,
      patient_id: patientId,
      battery_type: n.battery_type,
      brand: n.brand,
      qty_box: n.qty_box,
      qty_pack: n.qty_pack,
      qty_unit: n.qty_unit,
      delivered_at: deliveredAt,
      prescription_no: prescriptionNo || null,
      note: note || null,
      created_by: createdBy,
    };
  });

  const { error } = await supabaseClient
    .from('battery_prescription_deliveries')
    .insert(rows);

  if (error) {
    console.error('BATTERY_DELIVERIES_INSERT_FAILED:', {
      orgId,
      patientId,
      deliveredAt,
      rows,
      error,
    });
    throw new Error('BATTERY_DELIVERIES_INSERT_FAILED: ' + error.message);
  }
}

/**
 * List deliveries for a given patient.
 */
export async function fetchBatteryPrescriptionDeliveriesByPatient(
  patientId: string,
): Promise<BatteryPrescriptionDeliveryRow[]> {
  const id = safeTrim(patientId);
  if (!id) return [];

  const { data, error } = await supabaseClient
    .from('battery_prescription_deliveries')
    .select(
      [
        'id',
        'org_id',
        'patient_id',
        'battery_type',
        'brand',
        'qty_box',
        'qty_pack',
        'qty_unit',
        'delivered_at',
        'prescription_no',
        'note',
        'created_at',
        'created_by',
      ].join(', '),
    )
    .eq('patient_id', id)
    .order('delivered_at', { ascending: false });

  if (error) {
    console.error('BATTERY_DELIVERIES_FETCH_FAILED:', { patientId: id, error });
    throw error;
  }

  return (data ?? []) as BatteryPrescriptionDeliveryRow[];
}
