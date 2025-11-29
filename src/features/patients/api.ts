// src/features/patients/api.ts
// Barrel module for Patients feature API:
// - Re-exports query key and fetch function for listing patients.
// - Re-exports SGK + invoice mutation helpers.
// - Provides a typed createPatientFromForm wrapper used by PatientsPage
//   so React Query knows the variables/result types (NewPatientForm -> PatientRow).

import type { NewPatientForm, PatientRow } from './types';
import {
  createPatient,
  updatePatientSgkFields as updatePatientSgkFieldsInner,
  updatePatientInvoiceStatus as updatePatientInvoiceStatusInner,
} from './api/api.patients';
import {
  PATIENTS_QUERY_KEY,
  fetchPatients,
} from './api/api.core';
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
  // Formdan gelen yeni hastalar için invoice_issued default false kalsın.
  return createPatient(input);
}

// Re-exported symbols used across the app.
export {
  PATIENTS_QUERY_KEY,
  fetchPatients,
  importPatientsFromCsv,
  usePatientsCsvImportMutation,
};

// Mutations re-export (kept named the same as before).
export const updatePatientSgkFields = updatePatientSgkFieldsInner;
export const updatePatientInvoiceStatus = updatePatientInvoiceStatusInner;
