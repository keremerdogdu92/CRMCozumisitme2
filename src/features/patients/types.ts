// src/features/patients/types.ts
// Shared types for the Patients feature.

export type PatientPaymentMethod = 'Tim' | 'Sivantos' | 'Kredi_Kartı' | 'Nakit' | 'Senet';

export type PatientRow = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  last_visit_at: string | null;
  sgk_flag: boolean | null;
  sgk_prescription_received: boolean | null;
  sgk_recorded_to_system: boolean | null;

  // Payment summary fields on patients table
  payment_method: PatientPaymentMethod | null;
  card_sale_total: number | null;
  card_fee_rate: number | null;
  card_fee_amount: number | null;
};

// Form-level payment method value (boş = seçilmedi)
export type PatientPaymentMethodFormValue = '' | PatientPaymentMethod;

export type NewPatientForm = {
  fullName: string;
  phone: string;
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;

  /**
   * Payment method at registration:
   * - ''           → henüz seçilmedi
   * - 'Tim'        → Tedarikçi Tim
   * - 'Sivantos'   → Tedarikçi Sivantos
   * - 'Kredi_Kartı'→ POS / kredi kartı
   * - 'Nakit'      → nakit satış
   * - 'Senet'      → senetli satış (ayrıntılı plan patient_installment_plans tablosunda)
   */
  paymentMethod: PatientPaymentMethodFormValue;

  /**
   * Only used when paymentMethod === 'Kredi_Kartı'
   * - cardSaleTotal: kartla tahsil edilen toplam satış tutarı
   * - cardFeeRate: % komisyon oranı (3.5 gibi)
   * APİ tarafında bunlardan card_fee_amount hesaplanır.
   */
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
