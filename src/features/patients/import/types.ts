// src/features/patients/import/types.ts
// Shared type definitions for patients import jobs, staging rows, and validation payloads.

import type { LegacyDeviceImportNormalizedPayload } from './legacyDevicesValidator';

export type PatientsImportRow = {
  id: string;
  org_id: string;
  job_id: string;
  row_index: number;
  raw_row: Record<string, unknown>;
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

// --- Legacy patient devices import types ---
// These are used for staging rows in patients_legacy_devices_import_rows.

export type LegacyDevicesImportRow = {
  id: string;
  org_id: string;
  job_id: string;
  row_index: number;
  raw_row: Record<string, unknown>;
  normalized_payload: LegacyDeviceImportNormalizedPayload | null;
  status: 'pending' | 'validated' | 'error' | 'imported';
  error_message: string | null;
  created_at: string;
  validated_at: string | null;
  imported_at: string | null;
};

export type LegacyDevicesImportStatusSummary = {
  jobId: string;
  totalRows: number;
  importedRows: number;
  errorRows: number;
  validatedRows: number;
  warningRows: number;
};

export type InventoryImportRow = {
  id: number;
  job_id: string;
  row_index: number;
  raw_brand: string | null;
  raw_model: string | null;
  raw_item_type: string | null;
  raw_barcode: string | null;
  raw_serial_no: string | null;
  raw_status: string | null;
  raw_purchase_price: string | null;
  raw_list_price: string | null;
  raw_purchase_date: string | null;
  raw_notes: string | null;
  valid: boolean | null;
  validation_error: string | null;
};

export type InventoryImportStatusSummary = {
  jobId: string;
  totalRows: number;
  importedRows: number;
  errorRows: number;
  validatedRows: number;
  warningRows: number;
};
