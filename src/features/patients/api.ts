// src/features/patients/api.ts
// Barrel module for Patients feature API:
// - Re-exports query keys, fetch/search helpers and mutations.
// - Provides a typed createPatientFromForm wrapper used by PatientsPage
//   so React Query knows variables/result types (NewPatientForm -> PatientRow).

import type { NewPatientForm, PatientRow } from './types';

// Core query + search helpers
import {
  PATIENTS_QUERY_KEY,
  fetchPatients,
  searchPatientsByName,
  PATIENTS_BY_REFERENCE_QUERY_KEY,
  fetchPatientsByReferenceId,
} from './api/api.core';
import type { PatientForReference } from './api/api.core';

// Mutations on patients table
import {
  createPatient,
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
 * Takes a NewPatientForm and uses the low-level createPatient(...)
 * without any special options (invoice_issued = false by default).
 *
 * React Query infers:
 *   - variables: NewPatientForm
 *   - result:    PatientRow
 */
export async function createPatientFromForm(
  input: NewPatientForm,
): Promise<PatientRow> {
  return createPatient(input);
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
