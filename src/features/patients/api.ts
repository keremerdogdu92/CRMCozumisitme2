// src/features/patients/api.ts
// Summary: Patients feature API barrel module.
// Integrations:
// - Re-exports query keys, fetch/search helpers and mutations from ./api/*
// - Provides createPatientFromForm wrapper for typed React Query usage.
// - Provides soft delete + restore helpers via Supabase RPC:
//    * public.soft_delete_patients(p_id, p_reason)
//    * public.restore_patients(p_id)
//
// Security notes:
// - UI must NOT directly UPDATE deleted_at/deleted_by; it must call RPCs.
// - RPCs are org-scoped server-side via public.current_user_org_id().
// - deleted_by stamping is handled by DB trigger (trg_soft_delete_set_deleted_by).

import type { NewPatientForm, PatientRow } from './types';
import { supabaseClient } from '../../utils/supabaseClient';

// Core query + search helpers
import {
  PATIENTS_QUERY_KEY,
  fetchPatients,
  searchPatientsByName,
  PATIENTS_BY_REFERENCE_QUERY_KEY,
  fetchPatientsByReferenceId,
} from './api/api.core';
import type { PatientForReference } from './api/api.core';

// Low-level create + options type
import {
  createPatient as createPatientCore,
  type CreatePatientOptions,
} from './api/api.patients.create';

// Mutations on patients table (SGK, invoice status)
import {
  updatePatientSgkFields as updatePatientSgkFieldsInner,
  updatePatientInvoiceStatus as updatePatientInvoiceStatusInner,
} from './api/api.patients';

// Payments / installment plan hooks
import {
  usePatientInstallmentPlan,
  usePatientPayments,
  useUpsertPatientInstallmentPlanMutation,
} from './api/api.payments';

// CSV import helpers
import {
  importPatientsFromCsv,
  usePatientsCsvImportMutation,
} from './api/api.import';

/**
 * UI-level helper used by PatientsPage.
 *
 * Takes a NewPatientForm and uses the low-level createPatient(...).
 *
 * React Query infers:
 *   - variables: NewPatientForm
 *   - result:    PatientRow
 */
export async function createPatientFromForm(
  input: NewPatientForm,
  options?: CreatePatientOptions,
): Promise<PatientRow> {
  return createPatientCore(input, options);
}

/**
 * Soft delete a patient via DB RPC.
 *
 * IMPORTANT:
 * - Do NOT perform direct UPDATE on patients.deleted_at from client.
 * - Use RPC so org scoping and audit triggers remain consistent.
 */
export async function softDeletePatient(
  patientId: string,
  reason?: string | null,
): Promise<void> {
  const { error } = await supabaseClient.rpc('soft_delete_patients', {
    p_id: patientId,
    p_reason: reason ?? null,
  });

  if (error) {
    console.error('RPC soft_delete_patients failed', error);
    throw new Error(
      'Hasta silinirken bir hata oluştu. Lütfen tekrar deneyin.',
    );
  }
}

/**
 * Restore a soft-deleted patient via DB RPC.
 */
export async function restorePatient(patientId: string): Promise<void> {
  const { error } = await supabaseClient.rpc('restore_patients', {
    p_id: patientId,
  });

  if (error) {
    console.error('RPC restore_patients failed', error);
    throw new Error(
      'Hasta geri alınırken bir hata oluştu. Lütfen tekrar deneyin.',
    );
  }
}

// Re-exported symbols used across the app.
export {
  PATIENTS_QUERY_KEY,
  fetchPatients,
  searchPatientsByName,
  PATIENTS_BY_REFERENCE_QUERY_KEY,
  fetchPatientsByReferenceId,
  importPatientsFromCsv,
  usePatientsCsvImportMutation,
  usePatientInstallmentPlan,
  usePatientPayments,
  useUpsertPatientInstallmentPlanMutation,
};

// Mutations re-export (kept named the same as before).
export const updatePatientSgkFields = updatePatientSgkFieldsInner;
export const updatePatientInvoiceStatus = updatePatientInvoiceStatusInner;

// Types used by References feature.
export type { PatientForReference };
export type { CreatePatientOptions };
