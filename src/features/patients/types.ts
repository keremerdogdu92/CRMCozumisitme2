// src/features/patients/types.ts
// Shared types for the Patients feature.

/**
 * Valid payment method values as stored in the database.
 */
export type PatientPaymentMethodDbValue =
  | 'Tim'
  | 'Sivantos'
  | 'Kredi_Kartı'
  | 'Nakit'
  | 'Senet';

/**
 * Payment method value as used in forms.
 * Empty string means "not selected yet".
 */
export type PatientPaymentMethodFormValue =
  | ''
  | PatientPaymentMethodDbValue;

export type PatientRow = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  last_visit_at: string | null;
  sgk_flag: boolean | null;
  sgk_prescription_received: boolean | null;
  sgk_recorded_to_system: boolean | null;

  // Payment summary (nullable for eski kayıtlar)
  payment_method: PatientPaymentMethodDbValue | null;
  card_sale_total: number | null;
  card_fee_rate: number | null;
  card_fee_amount: number | null;
};

export type NewPatientForm = {
  fullName: string;
  phone: string;
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;

  // New payment fields
  paymentMethod: PatientPaymentMethodFormValue;
  cardSaleTotal: string;
  cardFeeRate: string;
};

export type PatientSgkUpdateInput = {
  id: string;
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;
};

/**
 * One senet payment row recorded via meetings.
 * Backed by meeting_payments table.
 */
export type PatientPaymentRow = {
  id: string;
  meeting_id: string | null;
  patient_id: string;
  amount: number;
  method: string | null;
  note: string | null;
  created_at: string;
};

/**
 * Patient installment (senet) plan row.
 * Backed by patient_installment_plans table.
 */
export type PatientInstallmentPlanRow = {
  id: string;
  org_id: string;
  patient_id: string;
  sale_total: number;
  upfront_paid: number;
  installment_count: number;
  installment_amount: number;
  first_due_date: string; // ISO date string
  day_of_month: number;
  status: 'active' | 'completed' | 'cancelled' | string;
  created_at: string;
  updated_at: string;
};

/**
 * Input for creating/updating a senet plan for a patient.
 * Values are string because they come from form fields.
 */
export type UpsertPatientInstallmentPlanInput = {
  patientId: string;
  saleTotal: string;
  upfrontPaid: string;
  installmentCount: string;
  firstDueDate: string; // yyyy-MM-dd
  dayOfMonth: string;   // "1"–"31"
};
