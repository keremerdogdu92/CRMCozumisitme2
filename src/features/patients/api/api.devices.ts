// src/features/patients/api/api.devices.ts
// Fetch helpers + React Query hook for inventory-backed patient devices.
// Lists inventory_items rows linked to a specific patient via sold_patient_id.

import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../../utils/supabaseClient';
import type { PatientDeviceRow } from '../types';

// React Query key for patient devices
export const PATIENT_DEVICES_BY_PATIENT_QUERY_KEY = (patientId: string) =>
  ['patient-devices', patientId] as const;

/**
 * Fetch devices from inventory_items for a given patient.
 * Filters by sold_patient_id = patientId.
 *
 * Note:
 * - ear_side is NULL in stock; it is set only after binding to a patient.
 * - We normalise ear_side so that 'none' (if ever stored) is treated as null.
 * - manufactured_at is not selected yet. When we add the column to
 *   inventory_items, we can extend the select + PatientDeviceRow.
 */
export async function fetchPatientDevicesByPatientId(
  patientId: string,
): Promise<PatientDeviceRow[]> {
  if (!patientId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('inventory_items')
    .select(
      `
      id,
      brand,
      model,
      item_type,
      ear_side,
      purchase_price,
      list_price,
      barcode,
      serial_no,
      sold_at
    `,
    )
    .eq('sold_patient_id', patientId)
    .order('sold_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error(
      'Supabase patient devices fetch error (fetchPatientDevicesByPatientId):',
      error,
    );
    throw error;
  }

  return (data ?? []).map((row: any): PatientDeviceRow => {
    const rawEar = (row.ear_side as string | null) ?? null;

    let ear_side: PatientDeviceRow['ear_side'] = null;
    if (rawEar === 'right' || rawEar === 'left' || rawEar === 'bilateral') {
      ear_side = rawEar;
    }
    // In stock state or legacy data, ear_side may be null or 'none' – we keep it null.

    return {
      id: row.id as string,
      brand: row.brand as string,
      model: row.model as string,
      item_type: row.item_type as PatientDeviceRow['item_type'],
      ear_side,
      purchase_price:
        row.purchase_price === null ? null : Number(row.purchase_price),
      list_price: row.list_price === null ? null : Number(row.list_price),
      barcode: (row.barcode as string | null) ?? null,
      serial_no: (row.serial_no as string | null) ?? null,
      sold_at: (row.sold_at as string | null) ?? null,
    };
  });
}

/**
 * React Query hook to load devices for a given patient.
 * Safe to call anywhere; if patientId is falsy the query is disabled.
 */
export function usePatientDevices(patientId: string | null) {
  return useQuery({
    queryKey: patientId
      ? PATIENT_DEVICES_BY_PATIENT_QUERY_KEY(patientId)
      : ['patient-devices', 'none'],
    enabled: !!patientId,
    queryFn: () => fetchPatientDevicesByPatientId(patientId as string),
  });
}
