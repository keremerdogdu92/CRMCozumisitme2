// src/features/patients/api.ts
// Supabase API helpers and React Query keys for the Patients feature.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type {
  NewPatientForm,
  PatientRow,
  PatientSgkUpdateInput,
  PatientPaymentRow,
  PatientInstallmentPlanRow,
  UpsertPatientInstallmentPlanInput,
  PatientPaymentMethod,
} from './types';

export const PATIENTS_QUERY_KEY = ['patients'] as const;

// Payment history per patient
export const PATIENT_PAYMENTS_BY_PATIENT_QUERY_KEY = (patientId: string) =>
  ['patient-payments', patientId] as const;

// Installment plan per patient
export const PATIENT_INSTALLMENT_PLAN_BY_PATIENT_QUERY_KEY = (
  patientId: string,
) => ['patient-installment-plan', patientId] as const;

/**
 * Patients attached to a specific reference.
 * Used by ReferenceDetailDrawer to list "Hastalar".
 */
export const PATIENTS_BY_REFERENCE_QUERY_KEY = (referenceId: string) =>
  ['patients-by-reference', referenceId] as const;

export interface PatientForReference {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  last_visit_at: string | null;
}

export async function fetchPatientsByReferenceId(
  referenceId: string,
): Promise<PatientForReference[]> {
  if (!referenceId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('patients')
    .select(
      `
      id,
      full_name,
      phone,
      created_at,
      last_visit_at
    `,
    )
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(
      'Supabase patients-by-reference fetch error:',
      error,
    );
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    full_name: row.full_name as string,
    phone: (row.phone as string | null) ?? null,
    created_at: row.created_at as string,
    last_visit_at: (row.last_visit_at as string | null) ?? null,
  }));
}

/**
 * Main Patients list.
 * NOTE: reads from view public.patient_list_with_device (patients + last sale).
 */
export async function fetchPatients(): Promise<PatientRow[]> {
  const { data, error } = await supabaseClient
    .from('patient_list_with_device')
    .select(
      `
      id,
      full_name,
      phone,
      created_at,
      last_visit_at,
      sgk_flag,
      sgk_prescription_received,
      sgk_recorded_to_system,
      satisfaction_10,
      national_id,
      address,
      kin_phone,
      archive_code,
      reference_id,
      references!patients_reference_id_fkey (
        id,
        full_name,
        phone
      ),
      payment_method,
      card_sale_total,
      card_fee_rate,
      card_fee_amount,
      device_brand,
      device_model,
      device_total_price
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase patients fetch error:', error);
    throw error;
  }

  // Normalize nested reference into flat fields for the UI.
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    full_name: row.full_name as string,
    phone: (row.phone as string | null) ?? null,
    created_at: row.created_at as string,
    last_visit_at: (row.last_visit_at as string | null) ?? null,

    sgk_flag: (row.sgk_flag as boolean | null) ?? null,
    sgk_prescription_received:
      (row.sgk_prescription_received as boolean | null) ?? null,
    sgk_recorded_to_system:
      (row.sgk_recorded_to_system as boolean | null) ?? null,

    satisfaction_10:
      (row.satisfaction_10 as number | null | undefined) ?? null,
    national_id:
      (row.national_id as string | null | undefined) ?? null,
    address: (row.address as string | null | undefined) ?? null,
    kin_phone:
      (row.kin_phone as string | null | undefined) ?? null,
    archive_code:
      (row.archive_code as string | null | undefined) ?? null,

    reference_id: (row.reference_id as string | null) ?? null,
    reference_name:
      (row.references?.full_name as string | null | undefined) ?? null,
    reference_phone:
      (row.references?.phone as string | null | undefined) ?? null,

    payment_method:
      (row.payment_method as PatientPaymentMethod | null) ?? null,
    card_sale_total:
      (row.card_sale_total as number | null | undefined) ?? null,
    card_fee_rate:
      (row.card_fee_rate as number | null | undefined) ?? null,
    card_fee_amount:
      (row.card_fee_amount as number | null | undefined) ?? null,

    device_brand:
      (row.device_brand as string | null | undefined) ?? null,
    device_model:
      (row.device_model as string | null | undefined) ?? null,
    device_total_price:
      (row.device_total_price as number | null | undefined) ?? null,
  })) as PatientRow[];
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

/**
 * Parse a money-like string ("20 000", "20.000", "20000,50") into number.
 */
function parseMoneyToNumber(raw: string, fieldCode: string): number {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(
      `${fieldCode}: Boş bırakılamaz, geçerli bir tutar girin.`,
    );
  }

  const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
  const value = Number(normalized);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `${fieldCode}: Geçerli bir tutar girin (0'dan büyük olmalı).`,
    );
  }

  return Number(value.toFixed(2));
}

/**
 * Create a new patient row with org_id taken from the current profile.
 * Returns the inserted PatientRow so that callers can immediately open the detail drawer.
 */
export async function createPatient(input: NewPatientForm): Promise<PatientRow> {
  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();
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
    console.error(
      'Failed to load profile for org_id (STEP_PROFILE):',
      profileError,
    );
    throw new Error('STEP_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    console.error('Profile org_id is missing (STEP_NO_ORG)', profile);
    throw new Error('STEP_NO_ORG: Profile org_id is missing');
  }

  // Payment metadata on patient row
  let payment_method: PatientPaymentMethod | null = null;
  let card_sale_total: number | null = null;
  let card_fee_rate: number | null = null;
  let card_fee_amount: number | null = null;

  if (input.paymentMethod) {
    payment_method = input.paymentMethod as PatientPaymentMethod;

    if (payment_method === 'Kredi_Kartı') {
      const saleTotalNum = parseMoneyToNumber(
        input.cardSaleTotal || '',
        'CARD_SALE_TOTAL',
      );

      const feeRateRaw = input.cardFeeRate.trim().replace(',', '.');
      const feeRateNum = Number(feeRateRaw);
      if (!Number.isFinite(feeRateNum) || feeRateNum <= 0) {
        throw new Error(
          'CARD_FEE_RATE: Geçerli bir komisyon oranı girin (0\'dan büyük).',
        );
      }

      card_sale_total = saleTotalNum;
      card_fee_rate = Number(feeRateNum.toFixed(2));
      card_fee_amount = Number(
        (saleTotalNum * (feeRateNum / 100)).toFixed(2),
      );
    }
  }

  const { data, error: insertError } = await supabaseClient
    .from('patients')
    .insert({
      org_id: profile.org_id,
      full_name: input.fullName.trim(),
      phone: input.phone.trim() || null,
      sgk_flag: input.sgkFlag,
      sgk_prescription_received: input.sgkFlag
        ? input.sgkPrescriptionReceived
        : false,
      sgk_recorded_to_system: input.sgkFlag
        ? input.sgkRecordedToSystem
        : false,
      reference_id: input.referenceId,
      payment_method,
      card_sale_total,
      card_fee_rate,
      card_fee_amount,
    })
    .select(
      `
      id,
      full_name,
      phone,
      created_at,
      last_visit_at,
      sgk_flag,
      sgk_prescription_received,
      sgk_recorded_to_system,
      satisfaction_10,
      national_id,
      address,
      kin_phone,
      archive_code,
      reference_id,
      payment_method,
      card_sale_total,
      card_fee_rate,
      card_fee_amount
    `,
    )
    .single();

  if (insertError) {
    console.error('Failed to insert patient (STEP_INSERT):', insertError);
    throw new Error('STEP_INSERT: ' + insertError.message);
  }

  // fetchPatients already joins + normalizes; here we only return the flat row.
  return {
    id: data.id as string,
    full_name: data.full_name as string,
    phone: (data.phone as string | null) ?? null,
    created_at: data.created_at as string,
    last_visit_at: (data.last_visit_at as string | null) ?? null,

    sgk_flag: (data.sgk_flag as boolean | null) ?? null,
    sgk_prescription_received:
      (data.sgk_prescription_received as boolean | null) ?? null,
    sgk_recorded_to_system:
      (data.sgk_recorded_to_system as boolean | null) ?? null,

    satisfaction_10:
      (data.satisfaction_10 as number | null | undefined) ?? null,
    national_id:
      (data.national_id as string | null | undefined) ?? null,
    address: (data.address as string | null | undefined) ?? null,
    kin_phone:
      (data.kin_phone as string | null | undefined) ?? null,
    archive_code:
      (data.archive_code as string | null | undefined) ?? null,

    reference_id: (data.reference_id as string | null) ?? null,
    reference_name: null,
    reference_phone: null,

    payment_method:
      (data.payment_method as PatientPaymentMethod | null) ?? null,
    card_sale_total:
      (data.card_sale_total as number | null | undefined) ?? null,
    card_fee_rate:
      (data.card_fee_rate as number | null | undefined) ?? null,
    card_fee_amount:
      (data.card_fee_amount as number | null | undefined) ?? null,

    // Device summary is not available on plain patients insert; will come after list refetch.
    device_brand: null,
    device_model: null,
    device_total_price: null,
  };
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
    console.error(
      'Failed to update patient SGK fields (STEP_UPDATE_SGK):',
      error,
    );
    throw new Error('STEP_UPDATE_SGK: ' + error.message);
  }
}

/**
 * Fetch payments for a single patient from meeting_payments.
 */
export async function fetchPatientPaymentsByPatientId(
  patientId: string,
): Promise<PatientPaymentRow[]> {
  if (!patientId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('meeting_payments')
    .select(
      `
      id,
      meeting_id,
      patient_id,
      amount,
      method,
      note,
      created_at
    `,
    )
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase patient payments fetch error:', error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    meeting_id: (row.meeting_id as string | null) ?? null,
    patient_id: row.patient_id as string,
    amount: Number(row.amount),
    method: (row.method as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    created_at: row.created_at as string,
  }));
}

/**
 * React Query hook: payment history.
 */
export function usePatientPayments(patientId: string | null) {
  return useQuery({
    queryKey: patientId
      ? PATIENT_PAYMENTS_BY_PATIENT_QUERY_KEY(patientId)
      : ['patient-payments', 'none'],
    enabled: !!patientId,
    queryFn: () => fetchPatientPaymentsByPatientId(patientId as string),
  });
}

/**
 * Fetch active installment plan for a single patient.
 */
export async function fetchActivePatientInstallmentPlan(
  patientId: string,
): Promise<PatientInstallmentPlanRow | null> {
  if (!patientId) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from
