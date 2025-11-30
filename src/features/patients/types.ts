// src/features/patients/types.ts
// Shared types for the Patients feature.

export type PatientPaymentMethod =
  | 'Tim'
  | 'Sivantos'
  | 'Kredi_Kartı'
  | 'Nakit'
  | 'Senet';

export type PatientPaymentMethodFormValue = '' | PatientPaymentMethod;

export type PatientRow = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  last_visit_at: string | null;
  sgk_flag: boolean | null;
  sgk_prescription_no: string | null;
  sgk_docs_received: boolean | null;
  sgk_processed: boolean | null;
  satisfaction_10: number | null;
  sgk_prescription_received: boolean | null;
  sgk_recorded_to_system: boolean | null;

  /**
   * SGK profile-based reimbursement metadata.
   * Optional for backward compatibility; existing rows may not have them.
   *
   * - sgk_profile: code such as 'SGK_0_4_CALISAN'
   * - sgk_expected_reimbursement: net TL amount expected from SGK
   * - sgk_expected_reimbursement_month: ISO date (yyyy-MM-01) for forecast
   */
  sgk_profile?: string | null;
  sgk_expected_reimbursement?: number | null;
  sgk_expected_reimbursement_month?: string | null;

  /**
   * Extra identity / contact info.
   */
  national_id: string | null;
  address: string | null;
  kin_phone: string | null;

  /**
   * Optional reference attached to the patient row.
   * Filled when the patient is created with a reference or later updated.
   */
  reference_id: string | null;
  /**
   * Convenience fields coming from the joined references table.
   * UI-only; backend always stores only reference_id.
   */
  reference_name: string | null;
  reference_phone: string | null;

  /**
   * Archive code for physical file / folder mapping.
   */
  archive_code: string | null;

  /**
   * Aggregated device info from patient_list_with_device view.
   * For now brand/model may be null until stock module is fully wired.
   *
   * device_total_price is the "first sale total" for this patient:
   * initial devices + included accessories on the first sale.
   */
  device_brand: string | null;
  device_model: string | null;
  device_total_price: number | null;

  // Payment metadata on the patient row (optional in v1).
  payment_method: PatientPaymentMethod | null;
  card_sale_total: number | null;
  card_fee_rate: number | null;
  card_fee_amount: number | null;

  /**
   * Invoice status tracking.
   * - invoice_issued: whether an invoice has been issued.
   * - invoice_issued_at: timestamp of the invoice issuance.
   *
   * Optional to stay compatible with older views/selects that do not
   * populate these fields yet.
   */
  invoice_issued?: boolean | null;
  invoice_issued_at?: string | null;
};

export type NewPatientForm = {
  fullName: string;
  phone: string;
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;

  /**
   * SGK profile selection and expected reimbursement.
   * Optional for now so that older flows (CSV import vb.) keep compiling.
   */
  sgkProfileId?: string;             // e.g. 'SGK_0_4_CALISAN'
  sgkExpectedReimbursement?: string; // TL string; parsed via parseMoneyToNumber
  sgkExpectedMonth?: string;         // "yyyy-MM" (UI: type="month")

  paymentMethod: PatientPaymentMethodFormValue;
  cardSaleTotal: string;
  cardFeeRate: string;

  /**
   * Optional reference attached while creating the patient.
   * Now fully wired to backend via patients.reference_id.
   */
  referenceId: string | null;
  referenceName: string;

  /**
   * Identity / contact / address fields collected on create.
   */
  nationalId: string;
  kinPhone: string;
  address: string;
};

export type PatientSgkUpdateInput = {
  id: string;
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;
  sgkPrescriptionNo: string;
};

/**
 * One payment row recorded via meetings.
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
  dayOfMonth: string; // "1"–"31"
};

/**
 * One inventory-backed device row attached to a patient via sold_patient_id.
 * Backed by inventory_items.
 *
 * Note:
 * - ear_side is always NULL in stock; it is set to 'right' / 'left' / 'bilateral'
 *   only after the device is bound to the patient and ear is chosen.
 * - manufactured_at is not included yet; when we add the column to
 *   inventory_items we will extend this type + API mapping.
 */
export type PatientDeviceItemType = 'hearing_aid' | 'charger';

export type PatientDeviceEarSide = 'right' | 'left' | 'bilateral' | null;

export type PatientDeviceRow = {
  id: string;
  brand: string;
  model: string;
  item_type: PatientDeviceItemType;
  ear_side: PatientDeviceEarSide;
  purchase_price: number | null;
  list_price: number | null;
  barcode: string | null;
  serial_no: string | null;
  sold_at: string | null;
};
