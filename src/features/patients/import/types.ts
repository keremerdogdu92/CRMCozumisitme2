// src/features/patients/import/types.ts
// Shared type definitions for patients import jobs, staging rows, and validation payloads.

export type PatientsImportRow = {
  id: string;
  org_id: string;
  job_id: string;
  row_index: number;
  raw_row: Record<string, any>;
  normalized_payload: PatientsImportNormalizedPayload | null;
  status: 'pending' | 'validated' | 'error' | 'imported';
  error_message: string | null;
  duplicate_of_patient_id: string | null;
  created_at: string;
  validated_at: string | null;
  imported_at: string | null;
};

export type PatientsImportIssueSeverity = 'error' | 'warning';

export type PatientsImportIssue = {
  row_index: number;
  field: string;
  severity: PatientsImportIssueSeverity;
  message: string;
  duplicate_of_patient_id?: string | null;
};

export type PatientsImportStatusSummary = {
  jobId: string;
  totalRows: number;
  importedRows: number;
  errorRows: number;
  validatedRows: number;
  warningRows: number;
};

export type PatientsImportNormalizedPayload = {
  org_id: string;
  full_name: string;
  phone: string;
  national_id: string | null;
  kin_phone: string | null;
  address: string | null;
  sgk_flag: boolean;
  sgk_prescription_received: boolean;
  sgk_recorded_to_system: boolean;
  payment_method: string | null;
  sale_total_amount: number | null;
  card_fee_rate: number | null;
  card_fee_amount: number | null;
  invoice_issued: boolean;
  invoice_issued_at: string | null;
  created_at: string | null;
};
