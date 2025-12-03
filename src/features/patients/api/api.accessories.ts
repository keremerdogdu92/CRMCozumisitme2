// src/features/patients/api/api.accessories.ts
// Patient-level accessories API: list accessories sold in meetings for a given patient.

import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../../utils/supabaseClient';
import type { MeetingAccessoryRow } from '../../meetings/types';

export type PatientAccessoryRow = MeetingAccessoryRow & {
  /**
   * Flattened meeting info for easier display in patient detail.
   */
  meeting_at: string | null;
  meeting_subject: string | null;
};

export const PATIENT_ACCESSORIES_BY_PATIENT_QUERY_KEY = (
  patientId: string | null,
) => ['patient-accessories', patientId ?? 'none'] as const;

type RawAccessoryRow = MeetingAccessoryRow & {
  meetings?: {
    at: string | null;
    subject: string | null;
  } | null;
};

export async function fetchPatientAccessoriesByPatientId(
  patientId: string | null,
): Promise<PatientAccessoryRow[]> {
  if (!patientId) return [];

  const { data, error } = await supabaseClient
    .from('meeting_accessories')
    .select(
      `
      id,
      meeting_id,
      patient_id,
      org_id,
      name,
      cost_price,
      sale_price,
      created_at,
      meetings (
        at,
        subject
      )
    `,
    )
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(
      'fetchPatientAccessoriesByPatientId query error:',
      error,
    );
    throw error;
  }

  const rows = (data ?? []) as RawAccessoryRow[];

  return rows.map((row) => ({
    id: row.id,
    meeting_id: row.meeting_id,
    patient_id: row.patient_id,
    org_id: row.org_id,
    name: row.name,
    cost_price: row.cost_price,
    sale_price: row.sale_price,
    created_at: row.created_at,
    meeting_at: row.meetings?.at ?? null,
    meeting_subject: row.meetings?.subject ?? null,
  }));
}

export function usePatientAccessories(patientId: string | null) {
  return useQuery<PatientAccessoryRow[]>({
    queryKey: PATIENT_ACCESSORIES_BY_PATIENT_QUERY_KEY(patientId),
    queryFn: () => fetchPatientAccessoriesByPatientId(patientId),
    enabled: !!patientId,
  });
}
