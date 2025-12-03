// src/features/patients/api/api.accessories.ts
// Accessory rows per patient, backed by meeting_accessories + meetings join.

import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../../utils/supabaseClient';

export const PATIENT_ACCESSORIES_QUERY_KEY = (patientId: string) =>
  ['patient-accessories', patientId] as const;

/**
 * Raw row coming from Supabase meeting_accessories join.
 * meetings alanı query tarafında array döneceği için burada
 * tek meeting bilgisini ayrı tipte ele alıyoruz.
 */
export type RawAccessoryRow = {
  id: string;
  meeting_id: string | null;
  patient_id: string;
  org_id: string;
  name: string;
  cost_price: number | null;
  sale_price: number | null;
  created_at: string;
  meetings?: {
    at: string | null;
    subject: string | null;
  } | null;
};

/**
 * UI-friendly row used by PatientDetailAccessoriesTab.
 */
export type PatientAccessoryRow = {
  id: string;
  meetingId: string | null;
  meetingAt: string | null;
  meetingSubject: string | null;
  name: string;
  costPrice: number | null;
  salePrice: number | null;
  createdAt: string;
};

export async function fetchAccessoriesForPatient(
  patientId: string,
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
      'fetchAccessoriesForPatient query error:',
      error,
    );
    throw error;
  }

  /**
   * Supabase tarafında ilişkili tablo her zaman array döner.
   * Burada ilk meeting kaydını alıp tek objeye indiriyoruz.
   */
  type SupabaseRow = Omit<RawAccessoryRow, 'meetings'> & {
    meetings?: { at: string | null; subject: string | null }[] | null;
  };

  const rows = (data ?? []) as SupabaseRow[];

  return rows.map((row) => {
    const firstMeeting = row.meetings?.[0] ?? null;

    return {
      id: row.id as string,
      meetingId: row.meeting_id as string | null,
      meetingAt: firstMeeting?.at ?? null,
      meetingSubject: firstMeeting?.subject ?? null,
      name: row.name as string,
      costPrice: row.cost_price as number | null,
      salePrice: row.sale_price as number | null,
      createdAt: row.created_at as string,
    };
  });
}

export function usePatientAccessories(patientId: string | null) {
  return useQuery<PatientAccessoryRow[]>({
    queryKey: PATIENT_ACCESSORIES_QUERY_KEY(patientId ?? 'none'),
    enabled: !!patientId,
    queryFn: () => fetchAccessoriesForPatient(patientId ?? ''),
  });
}
