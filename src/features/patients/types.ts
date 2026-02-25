// src/features/patients/types.ts
// Summary: Shared TypeScript types for the Patients feature (patients, devices, payments, SGK, battery flows).
//
// v2.10:
// - Aligns BatteryPrescriptionDelivery* types with DB schema for battery_prescription_deliveries:
//   - qty_boxes/qty_packs/qty_units (DB) instead of qty_box/qty_pack/qty_unit (old).
//   - Removes non-existent DB columns: brand, created_by (unless you add them to DB).
//   - Adds sgk_expected_amount (nullable) per DB.
// - Keeps BatteryLineDraft as UI draft; API maps it to DB rows.
//
// v2.11:
// - Adds sgk_recorded_to_system_at (optional) to PatientRow to mirror DB column.
//   * Used to show "sisteme işlendiği tarih" in patient detail SGK tab.
// - Extends PatientSgkUpdateInput to include sgkRecordedToSystemAt so UI can
//   persist the manual/system date into DB.
//
// v2.12:
// - Clarifies invoice tracking fields (invoice_issued / invoice_issued_at) usage:
//   * invoice_issued_at is set/cleared via a dedicated "Invoice Save" action in the detail drawer.
//
// v2.13:
// - Adds soft-delete fields (deleted_at / deleted_by / delete_reason) to PatientRow.
// - Adds is_battery_patient to PatientRow to match view selections and reporting needs.

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

  /**
   * Soft delete audit fields.
   * - deleted_at: when the row was soft-deleted
   * - deleted_by: auth.users.id of the user who deleted (if recorded)
   * - delete_reason: optional short reason
   *
   * NOTE:
   * - In normal (non-admin) list views, these fields may be missing or always null,
   *   depending on whether the source view includes deleted rows.
   */
  deleted_at?: string | null;
  deleted_by?: string | null;
  delete_reason?: string | null;

  sgk_flag: boolean | null;
  sgk_prescription_received: boolean | null;
  sgk_recorded_to_system: boolean | null;

  /**
   * When SGK "sisteme işlendi mi?" is marked true, this timestamp shows
   * when it was recorded. Optional for backward compatibility.
   */
  sgk_recorded_to_system_at?: string | null;

  /**
   * Battery patient marker:
   * True if patient ever received SGK battery prescription delivery.
   * Optional for backward compatibility with older selects.
   */
  is_battery_patient?: boolean | null;

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
   * - sgk_expected_reimbursement: net TL amount expected from SGK (TOTAL)
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

  /**
   * Optional explicit timestamp for "sisteme işlendi" info.
   * - When sgkRecordedToSystem = true:
   *   - If provided, DB will be set to this value.
   *   - If omitted, backend may fall back to now().
   * - When sgkRecordedToSystem = false:
   *   - DB will usually be set to NULL (clear).
   */
  sgkRecordedToSystemAt?: string | null;
};

export type PatientPaymentRow = {
  id: string;
  meeting_id: string | null;
  patient_id: string;
  amount: number;
  method: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

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

export type UpsertPatientInstallmentPlanInput = {
  patientId: string;
  saleTotal: string;
  upfrontPaid: string;
  installmentCount: string;
  firstDueDate: string; // yyyy-MM-dd
  dayOfMonth: string; // "1"–"31"
};

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

export type UpsertPatientSaleBreakdownItem = {
  id?: string;
  method: PatientPaymentMethod;
  amount: string;
  note: string;
};

export type PatientDeviceEarSide = 'right' | 'left' | 'bilateral';

export type PatientDeviceRow = {
  id: string;
  brand: string;
  model: string;
  item_type: 'hearing_aid' | 'charger' | string;
  ear_side: PatientDeviceEarSide | null;
  purchase_price: number | null;
  list_price: number | null;
  device_price: number | null;
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
  delivered_to_clinic_at?: string | null; // optional; keep compatibility if used elsewhere
  delivered_to_patient_at: string | null;
  expected_delivery_meeting_id: string | null;
  last_status_changed: string;
  cost: number | null;
  note: string | null;
};

export type NewPatientDeviceEarSide = 'right' | 'left' | 'bilateral' | '';

export type NewPatientDeviceDraft = {
  inventoryItemId?: string | null;
  side: NewPatientDeviceEarSide;
  brand: string;
  model: string;
  listPrice: string;
  salePrice: string;
  note: string;
};

/**
 * Device flow mode for the New Patient form.
 * This is UI/flow state (not necessarily stored in DB yet).
 */
export type NewPatientDeviceFlowType =
  | 'rechargeable_device' // hearing aids (rechargeable) + optional charger selection
  | 'battery_device' // hearing aids (battery) + batteries box rendered
  | 'battery_only'; // only batteries box rendered (no device drafts, no SGK profile)

export type BatteryType = '10' | '312' | '13' | '675';

export type BatteryQuantityDraft = {
  /**
   * These are "semantic" quantities to support future inventory without redesign:
   * - 1 box = 10 packs
   * - 1 pack = 6 units
   *
   * UI may not display derived unit totals everywhere.
   */
  box: number; // 0..n
  pack: number; // 0..n
  unit: number; // 0..n
};

export type BatteryLineDraft = {
  batteryType: BatteryType;
  brand: string;
  quantity: BatteryQuantityDraft;
};

export type NewPatientForm = {
  fullName: string;
  phone: string;

  /**
   * Flow selection at the top of device section.
   * Default: 'rechargeable_device'
   */
  deviceFlowType?: NewPatientDeviceFlowType;

  /**
   * Optional charger selection for rechargeable flow.
   * For now: store the selected inventory item id (inventory_items.id).
   */
  chargerInventoryItemId?: string | null;

  /**
   * Batteries draft (single line; multiple quantities per line).
   * Only used for battery_device and battery_only flows.
   */
  batteryLines?: BatteryLineDraft[];

  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;

  /**
   * SGK profile selection and expected reimbursement.
   * - sgkExpectedReimbursement is TOTAL (netToFirm * sgkDeviceCount).
   * - sgkDeviceCount is a manual choice (NOT derived from devices).
   */
  sgkProfileId?: string; // e.g. 'SGK_0_4_CALISAN'
  sgkExpectedReimbursement?: string; // TL string; parsed by parseMoneyToNumber
  sgkExpectedMonth?: string; // "yyyy-MM" (input type="month")
  sgkPrescriptionNo?: string;
  sgkDeviceCount?: '1' | '2';

  /**
   * Extra SGK checkbox for batteries (pilli cihaz / sadece pil).
   * When true and sgkFlag is enabled, UI will add the fixed extra reimbursement
   * based on sgkDeviceCount (e.g., 624 TL incl. VAT * 1/2).
   *
   * NOTE: This is flow-dependent. For rechargeable_device it should be ignored.
   */
  sgkPillPrescription?: boolean;

  paymentMethod: PatientPaymentMethodFormValue;
  saleTotal: string;
  cardFeeRate: string;

  legacySaleDate?: string;

  /**
   * Optional purchase date for the patient's devices.
   * - If null or undefined: defaults to now() when creating patient.
   * - If provided: used as sold_at for devices (format: yyyy-MM-dd or ISO string).
   */
  purchaseDate?: string | null;

  referenceId: string | null;
  referenceName: string;

  nationalId: string;
  kinPhone: string;
  address: string;

  saleBreakdownDraft?: UpsertPatientSaleBreakdownItem[];
  installmentPlanDraft?: UpsertPatientInstallmentPlanInput | null;

  deviceDrafts?: NewPatientDeviceDraft[];
};

/**
 * Battery prescription deliveries (pil reçetesi teslimleri).
 * Backed by battery_prescription_deliveries table (DB source of truth).
 *
 * IMPORTANT:
 * - These rows are used for reporting and to auto-mark is_battery_patient on patient row (trigger).
 * - This is NOT a "sale item" and should not live in meeting_accessories.
 */
export type BatteryPrescriptionDeliveryRow = {
  id: string;
  org_id: string;
  patient_id: string;

  delivered_at: string; // timestamptz ISO
  prescription_no: string | null;

  // Keep as string; DB is text and UI validates known sizes.
  battery_type: string;

  // Quantities (DB schema)
  qty_boxes: number | null;
  qty_packs: number | null;
  qty_units: number | null;

  // Expected SGK reimbursement for this delivery (TRY)
  sgk_expected_amount: number | null;

  note: string | null;
  created_at: string;
};

/**
 * Create input for inserting battery prescription delivery rows.
 * API maps BatteryLineDraft to 1 row per line (when qty > 0).
 *
 * NOTE:
 * - This input intentionally does not include org_id; caller passes orgId separately.
 * - deliveredAt is optional; default is now.
 */
export type CreateBatteryPrescriptionDeliveryInput = {
  patientId: string;

  /**
   * Optional: pass through SGK prescription number typed in SGK section.
   * If empty, DB will store NULL.
   */
  prescriptionNo?: string | null;

  /**
   * Optional: free text note for auditing.
   */
  note?: string | null;

  /**
   * Optional override for delivered_at. Default: now.
   */
  deliveredAt?: string | null;

  /**
   * Optional: expected SGK reimbursement for this delivery (TRY).
   * If omitted, DB stores NULL. (You can compute this later if needed.)
   */
  sgkExpectedAmount?: number | null;

  /**
   * Lines from UI draft. Caller is responsible for filtering out empty lines.
   */
  lines: BatteryLineDraft[];
};
