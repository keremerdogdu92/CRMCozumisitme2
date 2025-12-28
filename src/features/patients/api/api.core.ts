// src/features/patients/api/api.core.ts
// Summary: Core patient API helpers: query keys, listing, search and shared utilities.
// Integrations:
// - Reads from patient_list_with_device (active-only) and patient_list_with_device_all (includes deleted rows).
// - Soft delete visibility is controlled via SoftDeleteMode.
// - IMPORTANT: PostgREST errors if you select columns that do not exist in a view.
//   Therefore, deleted_* columns are requested ONLY when querying the *_all view.

import { supabaseClient } from '../../../utils/supabaseClient';
import type { PatientRow } from '../types';
import type { SoftDeleteMode } from '../../../utils/softDelete/softDeleteTypes';
import {
  isDeletedOnly,
  needsIncludeDeleted,
} from '../../../utils/softDelete/softDeleteTypes';

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
    .select('id, full_name, phone, created_at, last_visit_at')
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
 * Backed by:
 * - patient_list_with_device (default, active-only)
 * - patient_list_with_device_all (includes deleted rows)
 */
export async function fetchPatients(params?: {
  mode?: SoftDeleteMode;
}): Promise<PatientRow[]> {
  const mode: SoftDeleteMode = params?.mode ?? 'active';

  const includeDeleted = needsIncludeDeleted(mode);
  const source = includeDeleted
    ? 'patient_list_with_device_all'
    : 'patient_list_with_device';

  // NOTE:
  // Keep select lists explicit to avoid accidental schema drift.
  // Do NOT request deleted_* columns from the non-all view; PostgREST will error.
  const baseColumns: string[] = [
    'id',
    'full_name',
    'phone',
    'created_at',
    'last_visit_at',
    'sgk_flag',
    'sgk_prescription_no',
    'sgk_docs_received',
    'sgk_processed',
    'satisfaction_10',
    'sgk_prescription_received',
    'sgk_recorded_to_system',
    'sgk_recorded_to_system_at',
    'national_id',
    'address',
    'kin_phone',
    'reference_id',
    'reference_name',
    'reference_phone',
    'archive_code',
    'payment_method',
    'sale_total_amount',
    'card_fee_rate',
    'card_fee_amount',
    'device_brand',
    'device_model',
    'device_total_price',
    'device_ear_side_summary',
    'invoice_issued',
    'invoice_issued_at',
    'sgk_profile',
    'sgk_expected_reimbursement',
    'sgk_expected_reimbursement_month',
    'is_battery_patient',
  ];

  const deletedColumns: string[] = includeDeleted
    ? ['deleted_at', 'deleted_by', 'delete_reason']
    : [];

  const selectList = [...baseColumns, ...deletedColumns].join(', ');

  const { data, error } = await supabaseClient
    .from(source)
    .select(selectList)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase patients fetch error:', error);
    throw error;
  }

  const mapped = (data ?? []).map((row: any) => {
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
      sgk_recorded_to_system_at:
        (row.sgk_recorded_to_system_at as string | null | undefined) ?? null,

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

      // Archive + payment
      archive_code: (row.archive_code as string | null | undefined) ?? null,
      payment_method: (row.payment_method as any) ?? null,
      sale_total_amount:
        (row.sale_total_amount as number | null | undefined) ?? null,
      card_fee_rate:
        (row.card_fee_rate as number | null | undefined) ?? null,
      card_fee_amount:
        (row.card_fee_amount as number | null | undefined) ?? null,

      // Device summary
      device_brand: (row.device_brand as string | null | undefined) ?? null,
      device_model: (row.device_model as string | null | undefined) ?? null,
      device_total_price:
        (row.device_total_price as number | null | undefined) ?? null,
      device_ear_side_summary:
        (row.device_ear_side_summary as string | null | undefined) ?? null,

      // Invoice status
      invoice_issued:
        (row.invoice_issued as boolean | null | undefined) ?? null,
      invoice_issued_at:
        (row.invoice_issued_at as string | null | undefined) ?? null,

      // SGK profile-based reimbursement metadata
      sgk_profile: (row.sgk_profile as string | null | undefined) ?? null,
      sgk_expected_reimbursement:
        row.sgk_expected_reimbursement != null
          ? Number(row.sgk_expected_reimbursement)
          : null,
      sgk_expected_reimbursement_month:
        (row.sgk_expected_reimbursement_month as
          | string
          | null
          | undefined) ?? null,

      is_battery_patient: (row.is_battery_patient as boolean | null) ?? null,
    };

    // Keep deleted fields available for UI without forcing PatientRow to include them today.
    // This avoids a large refactor but keeps the data accessible.
    if (includeDeleted) {
      (patient as any).deleted_at = (row.deleted_at as string | null) ?? null;
      (patient as any).deleted_by = (row.deleted_by as string | null) ?? null;
      (patient as any).delete_reason =
        (row.delete_reason as string | null) ?? null;
    } else {
      (patient as any).deleted_at = null;
      (patient as any).deleted_by = null;
      (patient as any).delete_reason = null;
    }

    return patient;
  });

  if (!includeDeleted) {
    return mapped;
  }

  if (isDeletedOnly(mode)) {
    return mapped.filter((p) => (p as any).deleted_at != null);
  }

  return mapped;
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

  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    full_name: row.full_name as string,
  }));
}

/**
 * Parse a money-like string ("20 000", "20.000", "20000,50") into number.
 * Shared helper for patient creation and installment plans.
 */
export function parseMoneyToNumber(raw: string, fieldCode: string): number {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${fieldCode}: Boş bırakılamaz, geçerli bir tutar girin.`);
  }

  const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
  const value = Number(normalized);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldCode}: Geçerli bir tutar girin (0'dan büyük olmalı).`);
  }

  return Number(value.toFixed(2));
}
