// src/features/patients/types.ts
// Shared TypeScript types for the Patients feature.

export type PatientPaymentMethod =
  | 'Tim'
  | 'Sivantos'
  | 'Kredi_Kartı'
  | 'Nakit'
  | 'Senet'
  | 'legacy_unknown';

export type PatientPaymentMethodFormValue = '' | PatientPaymentMethod;

export type PatientRow = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  last_visit_at: string | null;
  sgk_flag: boolean | null;
  sgk_prescription_received: boolean | null;
  sgk_recorded_to_system: boolean | null;

  /**
   * Extra SGK / satisfaction fields stored on patients.
   * Marked optional to keep compatibility with older API
   * mapping code that may not select all columns yet.
   */
  sgk_prescription_no?: string | null;
  sgk_docs_received?: boolean | null;
  sgk_processed?: boolean | null;
  satisfaction_10?: number | null;

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
  national_id?: string | null;
  address?: string | null;
  kin_phone?: string | null;

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
  archive_code?: string | null;

  /**
   * Aggregated device info from patient_list_with_device view.
   * Brand/model/price + ear-side summary.
   */
  device_brand: string | null;
  device_model: string | null;
  device_total_price: number | null;
  device_ear_side_summary: string | null;

  /**
   * Payment metadata on the patient row.
   * - payment_method: 'Nakit', 'Kredi_Kartı', 'Senet', 'Tim', 'Sivantos'
   *   or 'legacy_unknown' for historical imports where method is unknown.
   * - sale_total_amount: toplam gerçek satış (cihaz + aksesuar, hizmetler dahil).
   * - card_fee_rate / card_fee_amount: yalnızca kredi kartı ile ödenen kısım için kullanılır.
   */
  payment_method: PatientPaymentMethod | null;
  sale_total_amount: number | null;
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
 * Per-patient payment breakdown for a sale.
 * Backed by patient_sale_breakdown table.
 *
 * Each row represents one part of the sale:
 * - method: 'Kredi_Kartı', 'Nakit', 'Tim', 'Sivantos', 'Senet'
 *           or 'legacy_unknown' for historical/unknown cases.
 * - amount: TL amount for that method
 * - note: optional explanation (e.g. "Firma katkısı", "Kapora" vb.)
 */
export type PatientSaleBreakdownRow = {
  id: string;
  org_id: string;
  patient_id: string;
  method: PatientPaymentMethod;
  amount: number;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

/**
 * Input type for editing the sale breakdown in UI.
 * Amount is kept as string for easier binding to <input />.
 */
export type UpsertPatientSaleBreakdownItem = {
  id?: string;
  method: PatientPaymentMethod;
  amount: string;
  note: string;
};

/**
 * Per-patient device rows resolved from inventory_items.
 * Used in PatientDetailDevicesTab via api.devices.ts.
 */
export type PatientDeviceEarSide = 'right' | 'left' | 'bilateral';

export type PatientDeviceRow = {
  id: string;
  brand: string;
  model: string;
  item_type: 'hearing_aid' | 'charger' | string;
  ear_side: PatientDeviceEarSide | null;
  purchase_price: number | null;
  list_price: number | null;
  barcode: string | null;
  serial_no: string | null;
  sold_at: string | null;
};

export type DeviceRepairStatus =
  | 'created'
  | 'shipped'
  | 'returned_waiting_meeting'
  | 'scheduled'
  | 'delivered'
  | 'cancelled';

export type DeviceRepairRow = {
  id: string;
  org_id: string;
  patient_id: string | null;
  inventory_item_id: string | null;
  status: DeviceRepairStatus;
  reason_note: string | null;
  cargo_company: string | null;
  cargo_tracking_no: string | null;
  shipped_at: string | null;
  returned_to_clinic_at: string | null;
  delivered_to_patient_at: string | null;
  expected_delivery_meeting_id: string | null;
  last_status_changed: string;
  cost: number | null;
  note: string | null;
};

/**
 * Draft devices collected on "New Patient" form.
 *
 * - inventoryItemId: optional link to an inventory_items row.
 *   Eğer doluysa, hasta kaydından sonra bu stok satırı hastaya bağlanır
 *   (sold_patient_id, sold_at, ear_side, status='sold').
 *
 * - Diğer alanlar UI için; brand/model/listPrice stok seçildiğinde
 *   otomatik doldurulabilir ama istenirse elle override edilebilir.
 */
export type NewPatientDeviceSide = 'right' | 'left' | 'bilateral' | '';

export type NewPatientDeviceDraft = {
  inventoryItemId?: string | null;
  side: NewPatientDeviceSide;
  brand: string;
  model: string;
  listPrice: string;
  salePrice: string;
  note: string;
};

/**
 * Input collected from the "New Patient" form.
 * Extended with optional financial drafts to chain:
 * - savePatientSaleBreakdown
 * - upsertPatientInstallmentPlan
 * after the patient row is created.
 */
export type NewPatientForm = {
  fullName: string;
  phone: string;
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;

  /**
   * SGK profile selection and expected reimbursement.
   * Optional for now so that older flows (CSV import vb.) still compile.
   */
  sgkProfileId?: string; // e.g. 'SGK_0_4_CALISAN'
  sgkExpectedReimbursement?: string; // TL string; parsed by parseMoneyToNumber
  sgkExpectedMonth?: string; // "yyyy-MM" (input type="month")
  sgkPrescriptionNo?: string;

  /**
   * Payment meta collected at creation time.
   * saleTotal: toplam gerçek satış; tüm ödeme türleri için zorunlu.
   * cardFeeRate: yalnızca Kredi Kartı için, taksit tablosundan gelir.
   */
  paymentMethod: PatientPaymentMethodFormValue;
  saleTotal: string;
  cardFeeRate: string;

  /**
   * Optional legacy sale date used only during CSV imports.
   * When provided, it is used to backfill patients.created_at and
   * invoice_issued_at (for rows imported as "invoice already issued").
   * Expected format: "yyyy-MM-dd".
   */
  legacySaleDate?: string;

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

  /**
   * Financial drafts used in "new patient" flow.
   * These are NOT persisted by createPatient directly; they are intended
   * to be chained with savePatientSaleBreakdown and
   * upsertPatientInstallmentPlan after the patient row is created.
   *
   * They are optional so that older callers (CSV import, tests, vb.)
   * continue to work without providing them.
   */
  saleBreakdownDraft?: UpsertPatientSaleBreakdownItem[];
  installmentPlanDraft?: UpsertPatientInstallmentPlanInput | null;

  /**
   * Device drafts collected at creation time.
   * Benzer şekilde, createPatient sonrasında inventory_items üzerinden
   * hastaya bağlanmak için kullanılır.
   */
  deviceDrafts?: NewPatientDeviceDraft[];
};
