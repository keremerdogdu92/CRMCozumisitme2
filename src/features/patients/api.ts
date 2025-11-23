// src/features/patients/api.ts
// Supabase API helpers and React Query keys for the Patients feature.

import { supabaseClient } from '../../utils/supabaseClient';
import type {
  NewPatientForm,
  PatientRow,
  PatientSgkUpdateInput,
} from './types';

export const PATIENTS_QUERY_KEY = ['patients'] as const;

export async function fetchPatients(): Promise<PatientRow[]> {
  const { data, error } = await supabaseClient
    .from('patients')
    .select(
      `
      id,
      full_name,
      phone,
      created_at,
      last_visit_at,
      sgk_flag,
      sgk_prescription_received,
      sgk_recorded_to_system
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase patients fetch error:', error);
    throw error;
  }

  return data ?? [];
}

/**
 * Lightweight search for patients by full_name.
 * Used by the Meetings subject picker to attach meetings to existing patients.
 */
export interface PatientLite {
  id: string;
  full_name: string;
}

export async function searchPatientsByName(
  query: string,
  limit = 10,
): Promise<PatientLite[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('patients')
    .select('id, full_name')
    .ilike('full_name', `%${trimmed}%`)
    .order('full_name', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Supabase patients search error:', error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    full_name: row.full_name as string,
  }));
}

// Create a new patient row with org_id taken from the current profile.
export async function createPatient(input: NewPatientForm): Promise<void> {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) {
    console.error('Failed to get current user (STEP_USER):', userError);
    throw new Error('STEP_USER: ' + userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('STEP_USER: User not authenticated');
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Failed to load profile for org_id (STEP_PROFILE):', profileError);
    throw new Error('STEP_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    console.error('Profile org_id is missing (STEP_NO_ORG)', profile);
    throw new Error('STEP_NO_ORG: Profile org_id is missing');
  }

  const { error: insertError } = await supabaseClient.from('patients').insert({
    org_id: profile.org_id,
    full_name: input.fullName.trim(),
    phone: input.phone.trim() || null,
    sgk_flag: input.sgkFlag,
    sgk_prescription_received: input.sgkFlag ? input.sgkPrescriptionReceived : false,
    sgk_recorded_to_system: input.sgkFlag ? input.sgkRecordedToSystem : false,
  });

  if (insertError) {
    console.error('Failed to insert patient (STEP_INSERT):', insertError);
    throw new Error('STEP_INSERT: ' + insertError.message);
  }
}

// Update SGK-related fields for a given patient.
export async function updatePatientSgkFields(
  params: PatientSgkUpdateInput,
): Promise<void> {
  const { id, sgkFlag, sgkPrescriptionReceived, sgkRecordedToSystem } = params;

  const { error } = await supabaseClient
    .from('patients')
    .update({
      sgk_flag: sgkFlag,
      sgk_prescription_received: sgkFlag ? sgkPrescriptionReceived : false,
      sgk_recorded_to_system: sgkFlag ? sgkRecordedToSystem : false,
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update patient SGK fields (STEP_UPDATE_SGK):', error);
    throw new Error('STEP_UPDATE_SGK: ' + error.message);
  }
}

/**
 * Payments fetched per patient from meeting_payments.
 */

export type PatientPaymentRow = {
  id: string;
  amount: number;
  method: string;
  note: string | null;
  created_at: string;
};

export const PATIENT_PAYMENTS_QUERY_KEY = (patientId: string) =>
  ['patient-payments', patientId] as const;

export async function fetchPatientPaymentsByPatientId(
  patientId: string,
): Promise<PatientPaymentRow[]> {
  if (!patientId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('meeting_payments')
    .select('id, amount, method, note, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase patient payments fetch error:', error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    amount: Number(row.amount),
    method: (row.method as string) ?? 'senet',
    note: (row.note as string | null) ?? null,
    created_at: row.created_at as string,
  }));
}
