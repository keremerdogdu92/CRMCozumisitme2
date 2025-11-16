// src/features/patients/types.ts
// Shared types for the Patients feature.

export type PatientRow = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  last_visit_at: string | null;
  sgk_flag: boolean | null;
  sgk_prescription_received: boolean | null;
  sgk_recorded_to_system: boolean | null;
};

export type NewPatientForm = {
  fullName: string;
  phone: string;
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;
};

export type PatientSgkUpdateInput = {
  id: string;
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;
};
