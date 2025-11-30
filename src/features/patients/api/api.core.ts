// src/features/patients/api/api.core.ts
// Core patient API helpers: query keys, listing, search and shared utilities.

import { supabaseClient } from '../../../utils/supabaseClient';
import type { PatientRow } from '../types';

// React Query keys
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
    console.error('Supabase patients-by-reference fetch error:', error);
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
 * Full patient list with device + reference info.
 * Backed by the patient_list_with_device view.
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
      sgk_prescription_no,
      sgk_docs_received,
      sgk_processed,
      satisfaction_10,
      sgk_prescription_received,
      sgk_recorded_to_system,
      national_id,
      address,
      kin_phone,
      reference_id,
      reference_name,
      reference_phone,
      archive_code,
      payment_method,
      card_sale_total,
      card_fee_rate,
      card_fee_amount,
      device_brand,
      device_model,
      device_total_price,
      invoice_issued,
      invoice_issued_at
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase patients fetch error:', error);
    throw error;
  }

  return (data ?? []).map((row: any) => {
    const patient: PatientRow = {
      id: row.id as string,
      full_name: row.full_name as string,
      phone: (row.phone as string | null) ?? null,
      created_at: row.created_at as string,
      last_visit_at: (row.last_visit_at as string | null) ?? null,

      // SGK + satisfaction
      sgk_flag: (row.sgk_flag as boolean | null) ?? null,
      sgk_prescription_no:
        (row.sgk_prescription_no as string | null | undefined) ?? null,
      sgk_docs_received:
        (row.sgk_docs_received as boolean | null | undefined) ?? null,
      sgk_processed:
        (row.sgk_processed as boolean | null | undefined) ?? null,
      satisfaction_10:
        row.satisfaction_10 != null ? Number(row.satisfaction_10) : null,
      sgk_prescription_received:
        (row.sgk_prescription_received as boolean | null | undefined) ?? null,
      sgk_recorded_to_system:
        (row.sgk_recorded_to_system as boolean | null | undefined) ?? null,

      // Identity / address / relative
      national_id: (row.national_id as string | null | undefined) ?? null,
      address: (row.address as string | null | undefined) ?? null,
      kin_phone: (row.kin_phone as string | null | undefined) ?? null,

      // Reference
      reference_id: (row.reference_id as string | null) ?? null,
      reference_name:
        (row.reference_name as string | null | undefined) ?? null,
      reference_phone:
        (row.reference_phone as string | null | undefined) ?? null,

      // Archive + card sale
      archive_code: (row.archive_code as string | null | undefined) ?? null,
      payment_method: (row.payment_method as any) ?? null,
      card_sale_total:
        (row.card_sale_total as number | null | undefined) ?? null,
      card_fee_rate:
        (row.card_fee_rate as number | null | undefined) ?? null,
      card_fee_amount:
        (row.card_fee_amount as number | null | undefined) ?? null,

      // Device summary
      device_brand: (row.device_brand as string | null | undefined) ?? null,
      device_model: (row.device_model as string | null | undefined) ?? null,
      device_total_price:
        (row.device_total_price as number | null
