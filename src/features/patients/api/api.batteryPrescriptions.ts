// src/features/patients/api/api.batteryPrescriptions.ts
// Summary: Patient battery prescription deliveries (SGK reimbursement events).
// Provides list + create helpers and a React Query hook.
// Notes:
// - This is NOT an accessory sale; it lives in its own table.
// - On create, we also mark patients.is_battery_patient = true.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../../utils/supabaseClient';

export const PATIENT_BATTERY_DELIVERIES_QUERY_KEY = (patientId: string) =>
  ['patient-battery-prescription-deliveries', patientId] as const;

export type BatteryPrescriptionDeliveryRow = {
  id: string;
  patientId: string;
  deliveredAt: string;
  prescriptionNo: string | null;
  batteryType: string;
  qtyBoxes: number | null;
  qtyPacks: number | null;
  qtyUnits: number | null;
  sgkExpectedAmount: number | null;
  note: string | null;
  createdAt: string;
};

type SupabaseDeliveryRow = {
  id: string;
  patient_id: string;
  delivered_at: string;
  prescription_no: string | null;
  battery_type: string;
  qty_boxes: number | null;
  qty_packs: number | null;
  qty_units: number | null;
  sgk_expected_amount: number | null;
  note: string | null;
  created_at: string;
};

export async function fetchBatteryPrescriptionDeliveriesForPatient(
  patientId: string,
): Promise<BatteryPrescriptionDeliveryRow[]> {
  if (!patientId) return [];

  const { data, error } = await supabaseClient
    .from('battery_prescription_deliveries')
    .select(
      `
      id,
      patient_id,
      delivered_at,
      prescription_no,
      battery_type,
      qty_boxes,
      qty_packs,
      qty_units,
      sgk_expected_amount,
      note,
      created_at
    `,
    )
    .eq('patient_id', patientId)
    .order('delivered_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error(
      'fetchBatteryPrescriptionDeliveriesForPatient query error:',
      error,
    );
    throw error;
  }

  const rows = (data ?? []) as SupabaseDeliveryRow[];

  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    deliveredAt: r.delivered_at,
    prescriptionNo: r.prescription_no ?? null,
    batteryType: r.battery_type,
    qtyBoxes: r.qty_boxes ?? null,
    qtyPacks: r.qty_packs ?? null,
    qtyUnits: r.qty_units ?? null,
    sgkExpectedAmount:
      r.sgk_expected_amount != null ? Number(r.sgk_expected_amount) : null,
    note: r.note ?? null,
    createdAt: r.created_at,
  }));
}

export type CreateBatteryPrescriptionDeliveryInput = {
  patientId: string;
  deliveredAtIso: string; // ISO
  prescriptionNo?: string;
  batteryType: string; // '10' | '312' | '13' | '675' etc
  qtyBoxes?: number | null;
  qtyPacks?: number | null;
  qtyUnits?: number | null;
  sgkExpectedAmount?: number | null;
  note?: string;
};

export async function createBatteryPrescriptionDelivery(
  input: CreateBatteryPrescriptionDeliveryInput,
): Promise<{ id: string }> {
  const {
    patientId,
    deliveredAtIso,
    prescriptionNo,
    batteryType,
    qtyBoxes,
    qtyPacks,
    qtyUnits,
    sgkExpectedAmount,
    note,
  } = input;

  // 1) Insert delivery row
  const { data: inserted, error: insertError } = await supabaseClient
    .from('battery_prescription_deliveries')
    .insert({
      patient_id: patientId,
      delivered_at: deliveredAtIso,
      prescription_no: prescriptionNo?.trim() ? prescriptionNo.trim() : null,
      battery_type: batteryType.trim(),
      qty_boxes: qtyBoxes ?? null,
      qty_packs: qtyPacks ?? null,
      qty_units: qtyUnits ?? null,
      sgk_expected_amount: sgkExpectedAmount ?? null,
      note: note?.trim() ? note.trim() : null,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('createBatteryPrescriptionDelivery insert error:', insertError);
    throw new Error(
      'Pil reçetesi teslimatı kaydedilemedi. Lütfen tekrar deneyin.',
    );
  }

  // 2) Mark patient as battery patient (best-effort but should succeed)
  const { error: patientUpdateError } = await supabaseClient
    .from('patients')
    .update({ is_battery_patient: true })
    .eq('id', patientId);

  if (patientUpdateError) {
    // Delivery exists; we still surface a clear message.
    console.error(
      'createBatteryPrescriptionDelivery patient flag update error:',
      patientUpdateError,
    );
    throw new Error(
      'Teslimat kaydedildi ancak hasta "pil hastası" olarak işaretlenemedi. Lütfen hasta kaydını kontrol edin.',
    );
  }

  return { id: inserted.id as string };
}

export function usePatientBatteryPrescriptionDeliveries(patientId: string | null) {
  return useQuery<BatteryPrescriptionDeliveryRow[]>({
    queryKey: PATIENT_BATTERY_DELIVERIES_QUERY_KEY(patientId ?? 'none'),
    enabled: !!patientId,
    queryFn: () =>
      fetchBatteryPrescriptionDeliveriesForPatient(patientId ?? ''),
  });
}

export function useCreateBatteryPrescriptionDeliveryMutation(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBatteryPrescriptionDeliveryInput) =>
      createBatteryPrescriptionDelivery(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: PATIENT_BATTERY_DELIVERIES_QUERY_KEY(patientId),
      });
      // Patient list view may not reflect is_battery_patient yet (view update later),
      // but we still refresh the list in case other fields change.
      void queryClient.invalidateQueries({ queryKey: ['patients'] as const });
    },
  });
}
