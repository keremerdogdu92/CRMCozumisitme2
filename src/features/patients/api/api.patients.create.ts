// src/features/patients/api/api.patients.create.ts
// Create patient rows and attach optional financial/device drafts.
//
// Patch v2.14:
// - CHANGE: Respect deviceFlowType === 'battery_only' as "SGK-only battery patient":
//   * paymentMethod / saleTotal / cardFeeRate become optional at backend as well
//     (no validation error; payment_* columns remain NULL).
//   * Aligns with useNewPatientForm v2.9 behavior.
// - ADD: When SGK is enabled and sgkRecordedToSystem is true on creation,
//   sgk_recorded_to_system_at is set to now().
//
// Patch v2.13:
// - ADD: Optional linkedTrialId support via CreatePatientOptions.
//   * If provided, after successful patient insert + chaining, calls
//     linkTrialToPatientAndDelete(trialId, patientId).
//   * If the RPC fails, an explicit STEP_TRIAL_LINK_FAILED error is thrown
//     so the caller can surface/handle it.
//
// Patch v2.12:
// - CHANGE: createPatient no longer auto-saves saleBreakdownDraft.
//   * patient_sale_breakdown rows are now managed only from the Payments tab
//     via PatientDetailPaymentsTab + PatientSaleBreakdownCard.
//   * This avoids duplicate "Ödeme dağılımı" lines and keeps patients.sale_total_amount
//     as the single source of truth for total sales.
//
// Patch v2.11:
// - CHANGE: Auto-create battery_prescription_deliveries when deviceFlowType is
//   'battery_device' or 'battery_only' AND SGK is enabled AND at least one battery line has qty > 0.
//   (Removed dependency on sgkPillPrescription checkbox to match the requested behavior.)
// - CLEANUP: recordBatteryPrescriptionDeliveries no longer accepts createdBy (DB schema has no created_by).
// - Keeps best-effort behavior (delivery insert failure does not fail patient creation).
//
// v2.10 notes (kept):
// - FIX (critical): Device attach honors draft.inventoryItemId (kept from v2.9).
// - CHANGE (critical): batteryLines are no longer recorded as meeting_accessories.
//   Instead, "pil reçetesi teslimi" is recorded in battery_prescription_deliveries.
//   This is the reporting source of truth and triggers is_battery_patient via DB trigger.
// - Uses sgkPrescriptionNo as prescription_no for battery delivery (best-effort).

import { supabaseClient } from '../../../utils/supabaseClient';
import type {
  NewPatientForm,
  PatientRow,
  PatientPaymentMethod,
  NewPatientDeviceDraft,
  BatteryLineDraft,
} from '../types';
import { parseMoneyToNumber } from './api.core';
import { upsertPatientInstallmentPlan } from './api.payments';
import { createBatteryPrescriptionDeliveries } from './api.batteryPrescriptionDeliveries';
import { linkTrialToPatientAndDelete } from '../../trials/api';

export type CreatePatientOptions = {
  /**
   * If true, the patient will be created as "invoice already issued".
   * Used mainly for CSV imports where historical patients are loaded.
   */
  setInvoiceIssuedTrue?: boolean;

  /**
   * Optional: if this patient is created from an existing trial,
   * pass the trial id here so we can link + delete the trial via RPC.
   */
  linkedTrialId?: string;
};

type InventoryItemStatus = 'in_stock' | 'sold' | string;
type InventoryEarSide = 'right' | 'left' | 'bilateral' | null;
type PatientInsertPayload = Record<string, unknown>;
type PatientInsertDbRow = Record<string, unknown>;

function normalizeSide(side: string): InventoryEarSide {
  return side === 'right' || side === 'left' || side === 'bilateral'
    ? (side as InventoryEarSide)
    : null;
}

function safeTrim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function qtyTotal(line: BatteryLineDraft): number {
  const q = line.quantity ?? { box: 0, pack: 0, unit: 0 };
  const box = Number.isFinite(q.box) ? q.box : 0;
  const pack = Number.isFinite(q.pack) ? q.pack : 0;
  const unit = Number.isFinite(q.unit) ? q.unit : 0;
  return box + pack + unit;
}

/**
 * Attach inventory_items to a patient based on device drafts collected in the form.
 * Best-effort only; failures are logged but do not fail the patient creation.
 *
 * Rules:
 * - If draft.inventoryItemId exists:
 *   update ONLY that row with guards: org_id + status=in_stock + deleted_at IS NULL.
 * - Else:
 *   fallback to brand/model lookup (first in_stock row), but WARN because it can mismatch.
 */
async function attachDevicesToPatientFromDrafts(params: {
  orgId: string;
  patientId: string;
  drafts: NewPatientDeviceDraft[];
  purchaseDate?: string | null;
}): Promise<void> {
  const { orgId, patientId, drafts, purchaseDate } = params;
  if (!drafts || drafts.length === 0) return;

  // Use provided purchase date if available, otherwise use current date
  const soldAtIso = purchaseDate
    ? new Date(purchaseDate).toISOString()
    : new Date().toISOString();

  for (const draft of drafts) {
    const inventoryItemId = safeTrim(draft.inventoryItemId ?? '');
    const brand = safeTrim(draft.brand);
    const model = safeTrim(draft.model);

    // Side is optional and may be empty string from UI.
    const side = normalizeSide(safeTrim(draft.side));

    // If inventoryItemId is provided, we must use it and ignore brand/model matching.
    if (inventoryItemId) {
      try {
        const { data: updatedRows, error: updateError } = await supabaseClient
          .from('inventory_items')
          .update({
            sold_patient_id: patientId,
            sold_at: soldAtIso,
            status: 'sold',
            ear_side: side,
          })
          .eq('id', inventoryItemId)
          .eq('org_id', orgId)
          .eq('status', 'in_stock' as InventoryItemStatus)
          .is('deleted_at', null)
          .select('id');

        if (updateError) {
          console.error(
            'STEP_DEVICE_ATTACH_UPDATE_BY_ID: Failed to update inventory_items by inventoryItemId',
            { orgId, inventoryItemId, patientId, updateError },
          );
          continue;
        }

        const updated = (updatedRows ?? []) as { id: string }[];
        if (updated.length === 0) {
          console.warn(
            'STEP_DEVICE_ATTACH_UPDATE_BY_ID_NOOP: inventoryItemId not updated (not in_stock / wrong org / deleted)',
            { orgId, inventoryItemId, patientId },
          );
          continue;
        }

        continue;
      } catch (err) {
        console.error(
          'STEP_DEVICE_ATTACH_BY_ID_UNEXPECTED: Unexpected error while attaching device by inventoryItemId',
          { orgId, inventoryItemId, patientId, err },
        );
        continue;
      }
    }

    // No inventoryItemId → fallback path.
    // Requires brand/model (otherwise we cannot resolve a stock item).
    if (!brand || !model) continue;

    console.warn(
      'STEP_DEVICE_ATTACH_FALLBACK_USED: inventoryItemId missing; falling back to brand/model match (may be wrong if duplicates exist)',
      { orgId, patientId, brand, model },
    );

    try {
      const { data, error } = await supabaseClient
        .from('inventory_items')
        .select('id')
        .eq('org_id', orgId)
        .eq('brand', brand)
        .eq('model', model)
        .eq('status', 'in_stock' as InventoryItemStatus)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) {
        console.error(
          'STEP_DEVICE_ATTACH_QUERY_FALLBACK: Failed to query inventory_items for device draft fallback',
          { orgId, brand, model, error },
        );
        continue;
      }

      const row = (data ?? [])[0] as { id: string } | undefined;
      if (!row) {
        console.warn(
          'STEP_DEVICE_ATTACH_NO_MATCH_FALLBACK: No in_stock inventory item found for fallback match',
          { orgId, brand, model },
        );
        continue;
      }

      const { data: updatedRows, error: updateError } = await supabaseClient
        .from('inventory_items')
        .update({
          sold_patient_id: patientId,
          sold_at: soldAtIso,
          status: 'sold',
          ear_side: side,
        })
        .eq('id', row.id)
        .eq('org_id', orgId)
        .eq('status', 'in_stock' as InventoryItemStatus)
        .is('deleted_at', null)
        .select('id');

      if (updateError) {
        console.error(
          'STEP_DEVICE_ATTACH_UPDATE_FALLBACK: Failed to update inventory_items row for fallback match',
          { orgId, inventoryItemId: row.id, patientId, updateError },
        );
        continue;
      }

      const updated = (updatedRows ?? []) as { id: string }[];
      if (updated.length === 0) {
        console.warn(
          'STEP_DEVICE_ATTACH_UPDATE_FALLBACK_NOOP: Fallback candidate not updated (race / not in_stock / deleted)',
          { orgId, inventoryItemId: row.id, patientId },
        );
        continue;
      }
    } catch (err) {
      console.error(
        'STEP_DEVICE_ATTACH_FALLBACK_UNEXPECTED: Unexpected error while attaching device fallback',
        { orgId, patientId, brand, model, err },
      );
      continue;
    }
  }
}

/**
 * Mark a charger inventory item as sold and linked to the patient.
 * Best-effort only.
 */
async function attachChargerToPatient(params: {
  orgId: string;
  patientId: string;
  chargerInventoryItemId: string;
  purchaseDate?: string | null;
}): Promise<void> {
  const { orgId, patientId, chargerInventoryItemId, purchaseDate } = params;
  const id = safeTrim(chargerInventoryItemId);
  if (!id) return;

  // Use provided purchase date if available, otherwise use current date
  const soldAtIso = purchaseDate
    ? new Date(purchaseDate).toISOString()
    : new Date().toISOString();

  try {
    const { data: updatedRows, error } = await supabaseClient
      .from('inventory_items')
      .update({
        sold_patient_id: patientId,
        sold_at: soldAtIso,
        status: 'sold',
        // chargers should not carry ear_side; do not overwrite existing value unless needed
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .eq('status', 'in_stock' as InventoryItemStatus)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      console.error('STEP_CHARGER_ATTACH_UPDATE: Failed to mark charger as sold', {
        orgId,
        patientId,
        chargerInventoryItemId: id,
        error,
      });
      return;
    }

    const updated = (updatedRows ?? []) as { id: string }[];
    if (updated.length === 0) {
      console.warn(
        'STEP_CHARGER_ATTACH_NOOP: chargerInventoryItemId not updated (not in_stock / wrong org / deleted)',
        { orgId, patientId, chargerInventoryItemId: id },
      );
    }
  } catch (err) {
    console.error(
      'STEP_CHARGER_ATTACH_UNEXPECTED: Unexpected error while attaching charger',
      { orgId, patientId, chargerInventoryItemId: id, err },
    );
  }
}

/**
 * Record "pil reçetesi teslimi" rows in battery_prescription_deliveries.
 * Best-effort: errors are logged but do not fail patient creation.
 */
async function recordBatteryPrescriptionDeliveries(params: {
  orgId: string;
  patientId: string;
  batteryLines: BatteryLineDraft[];
  prescriptionNo: string | null;
}): Promise<void> {
  const { orgId, patientId, batteryLines, prescriptionNo } = params;
  const lines = (batteryLines ?? []).filter((l) => qtyTotal(l) > 0);
  if (lines.length === 0) return;

  try {
    await createBatteryPrescriptionDeliveries({
      orgId,
      input: {
        patientId,
        lines,
        prescriptionNo: prescriptionNo ? prescriptionNo.trim() : null,
        deliveredAt: null, // default now
        note: null,
      },
    });
  } catch (err) {
    console.error(
      'STEP_BATTERY_DELIVERY_CHAIN_FAILED: Failed to insert battery_prescription_deliveries rows (best-effort)',
      { orgId, patientId, err },
    );
  }
}

/**
 * Create a new patient row with org_id taken from the current profile.
 * Also chains optional sale breakdown, installment plan and device drafts.
 */
export async function createPatient(
  input: NewPatientForm,
  options?: CreatePatientOptions,
): Promise<PatientRow> {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();

  if (userError) {
    console.error('Failed to get current user (STEP_USER):', userError);
    throw new Error('STEP_USER: ' + userError.message);
  }

  const user = userData.user;
  if (!user) {
    throw new Error('STEP_USER: User not authenticated');
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Failed to load profile for org_id (STEP_PROFILE):', profileError);
    throw new Error('STEP_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    console.error('Profile org_id is missing (STEP_NO_ORG)', profile);
    throw new Error('STEP_NO_ORG: Profile org_id is missing');
  }

  const orgId = profile.org_id as string;

  // Flow type affects payment requirements.
  const deviceFlowType = input.deviceFlowType ?? 'rechargeable_device';
  const isBatteryOnly = deviceFlowType === 'battery_only';

  // Legacy sale date override (mainly for CSV imports)
  let legacyCreatedAt: string | null = null;
  let legacyInvoiceIssuedAt: string | null = null;

  if (input.legacySaleDate) {
    const raw = input.legacySaleDate.trim();
    if (raw) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        const iso = parsed.toISOString();
        legacyCreatedAt = iso;
        legacyInvoiceIssuedAt = iso;
      } else {
        console.warn('LEGACY_SALE_DATE_INVALID: Unable to parse legacy sale date on createPatient', {
          raw,
        });
      }
    }
  }

  // Payment metadata on patient row
  let payment_method: PatientPaymentMethod | null = null;
  let sale_total_amount: number | null = null;
  let card_fee_rate: number | null = null;
  let card_fee_amount: number | null = null;

  if (!isBatteryOnly) {
    if (!input.paymentMethod) {
      throw new Error('PAYMENT_METHOD: Ödeme şekli zorunludur.');
    }

    const saleTotalRaw = input.saleTotal?.trim() ?? '';
    if (!saleTotalRaw) {
      throw new Error('SALE_TOTAL_AMOUNT: Toplam satış tutarı zorunludur.');
    }

    sale_total_amount = parseMoneyToNumber(saleTotalRaw, 'SALE_TOTAL_AMOUNT');

    if (input.paymentMethod) {
      payment_method = input.paymentMethod as PatientPaymentMethod;

      if (payment_method === 'Kredi_Kartı') {
        const feeRateRaw = input.cardFeeRate.trim().replace(',', '.');
        const feeRateNum = Number(feeRateRaw);

        if (!Number.isFinite(feeRateNum) || feeRateNum <= 0) {
          throw new Error("CARD_FEE_RATE: Geçerli bir komisyon oranı girin (0'dan büyük).");
        }

        card_fee_rate = Number(feeRateNum.toFixed(2));

        if (sale_total_amount != null) {
          card_fee_amount = Number((sale_total_amount * (feeRateNum / 100)).toFixed(2));
        }
      }
    }
  } else {
    // battery_only: SGK-only battery patient (no financials on patient row).
    payment_method = null;
    sale_total_amount = null;
    card_fee_rate = null;
    card_fee_amount = null;
  }

  // SGK profile-based expected reimbursement (optional)
  let sgk_profile: string | null = null;
  let sgk_expected_reimbursement: number | null = null;
  let sgk_expected_reimbursement_month: string | null = null;

  if (input.sgkFlag) {
    if (input.sgkProfileId && input.sgkProfileId.trim().length > 0) {
      sgk_profile = input.sgkProfileId.trim();
    }

    if (input.sgkExpectedReimbursement) {
      sgk_expected_reimbursement = parseMoneyToNumber(
        input.sgkExpectedReimbursement,
        'SGK_EXPECTED_REIMBURSEMENT',
      );
    }

    if (input.sgkExpectedMonth) {
      const [yearStr, monthStr] = input.sgkExpectedMonth.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);

      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        throw new Error('SGK_EXPECTED_MONTH: Geçerli bir ay seçin (yyyy-AA).');
      }

      const date = new Date(Date.UTC(year, month - 1, 15));
      sgk_expected_reimbursement_month = date.toISOString().slice(0, 10);
    }
  }

  const shouldMarkInvoiceIssued = options?.setInvoiceIssuedTrue === true;
  const nowIso = new Date().toISOString();
  const invoiceIssuedAt = shouldMarkInvoiceIssued ? legacyInvoiceIssuedAt ?? nowIso : null;

  const sgkRecordedToSystemAt =
    input.sgkFlag && input.sgkRecordedToSystem ? nowIso : null;

  const insertPayload: PatientInsertPayload = {
    org_id: orgId,
    full_name: input.fullName.trim(),
    phone: input.phone.trim() || null,
    sgk_flag: input.sgkFlag,
    sgk_prescription_received: input.sgkFlag ? input.sgkPrescriptionReceived : false,
    sgk_recorded_to_system: input.sgkFlag ? input.sgkRecordedToSystem : false,
    sgk_recorded_to_system_at: sgkRecordedToSystemAt,
    reference_id: input.referenceId,
    payment_method,
    sale_total_amount,
    card_fee_rate,
    card_fee_amount,
    sgk_prescription_no: null,
    sgk_docs_received: null,
    sgk_processed: null,
    satisfaction_10: null,
    national_id: input.nationalId.trim() || null,
    address: input.address.trim() || null,
    kin_phone: input.kinPhone.trim() || null,
    sgk_profile,
    sgk_expected_reimbursement,
    sgk_expected_reimbursement_month,
    sgk_rate_period_id: input.sgkFlag ? input.sgkRatePeriodId ?? null : null,
    sgk_profile_rate_id: input.sgkFlag ? input.sgkProfileRateId ?? null : null,
    sgk_rate_effective_date: input.sgkFlag
      ? input.sgkRateEffectiveDate ?? null
      : null,
    sgk_device_count: input.sgkFlag
      ? Number(input.sgkDeviceCount ?? '1')
      : null,
    sgk_pill_prescription: input.sgkFlag ? !!input.sgkPillPrescription : false,
    sgk_base_reimbursement: input.sgkFlag
      ? input.sgkBaseReimbursement ?? null
      : null,
    sgk_pill_extra_amount: input.sgkFlag
      ? input.sgkPillExtraAmount ?? null
      : null,
    invoice_issued: shouldMarkInvoiceIssued,
    invoice_issued_at: invoiceIssuedAt,
  };

  // Custom creation date: from purchaseDate (manual entry) or legacy import
  if (input.purchaseDate) {
    // User manually set a purchase date - use it for created_at
    const purchaseDateIso = new Date(input.purchaseDate).toISOString();
    insertPayload.created_at = purchaseDateIso;
  } else if (legacyCreatedAt) {
    // Legacy CSV import override
    insertPayload.created_at = legacyCreatedAt;
  }

  const { data, error: insertError } = await supabaseClient
    .from('patients')
    .insert(insertPayload)
    .select(
      [
        'id',
        'full_name',
        'phone',
        'created_at',
        'last_visit_at',
        'sgk_flag',
        'sgk_prescription_no',
        'sgk_docs_received',
        'sgk_processed',
        'satisfaction_10',
        'sgk_prescription_received',
        'sgk_recorded_to_system',
        'sgk_recorded_to_system_at',
        'national_id',
        'address',
        'kin_phone',
        'reference_id',
        'archive_code',
        'payment_method',
        'sale_total_amount',
        'card_fee_rate',
        'card_fee_amount',
        'sgk_profile',
        'sgk_expected_reimbursement',
        'sgk_expected_reimbursement_month',
        'sgk_rate_period_id',
        'sgk_profile_rate_id',
        'sgk_rate_effective_date',
        'sgk_device_count',
        'sgk_pill_prescription',
        'sgk_base_reimbursement',
        'sgk_pill_extra_amount',
        'invoice_issued',
        'invoice_issued_at',
      ].join(', '),
    )
    .single();

  if (insertError) {
    console.error('Failed to insert patient (STEP_INSERT):', insertError);
    throw new Error('STEP_INSERT: ' + insertError.message);
  }

  const row = data as unknown as PatientInsertDbRow;

  const inserted: PatientRow = {
    id: row.id as string,
    full_name: row.full_name as string,
    phone: (row.phone as string | null) ?? null,
    created_at: row.created_at as string,
    last_visit_at: (row.last_visit_at as string | null) ?? null,
    sgk_flag: (row.sgk_flag as boolean | null) ?? null,
    sgk_prescription_no: (row.sgk_prescription_no as string | null | undefined) ?? null,
    sgk_docs_received: (row.sgk_docs_received as boolean | null | undefined) ?? null,
    sgk_processed: (row.sgk_processed as boolean | null | undefined) ?? null,
    satisfaction_10: row.satisfaction_10 != null ? Number(row.satisfaction_10) : null,
    sgk_prescription_received: (row.sgk_prescription_received as boolean | null | undefined) ?? null,
    sgk_recorded_to_system: (row.sgk_recorded_to_system as boolean | null | undefined) ?? null,
    sgk_recorded_to_system_at:
      (row.sgk_recorded_to_system_at as string | null | undefined) ?? null,
    national_id: (row.national_id as string | null | undefined) ?? null,
    address: (row.address as string | null | undefined) ?? null,
    kin_phone: (row.kin_phone as string | null | undefined) ?? null,
    reference_id: (row.reference_id as string | null) ?? null,
    reference_name: null,
    reference_phone: null,
    archive_code: (row.archive_code as string | null | undefined) ?? null,
    sgk_profile: (row.sgk_profile as string | null | undefined) ?? null,
    sgk_expected_reimbursement:
      row.sgk_expected_reimbursement != null ? Number(row.sgk_expected_reimbursement) : null,
    sgk_expected_reimbursement_month:
      (row.sgk_expected_reimbursement_month as string | null | undefined) ?? null,
    sgk_rate_period_id:
      (row.sgk_rate_period_id as string | null | undefined) ?? null,
    sgk_profile_rate_id:
      (row.sgk_profile_rate_id as string | null | undefined) ?? null,
    sgk_rate_effective_date:
      (row.sgk_rate_effective_date as string | null | undefined) ?? null,
    sgk_device_count:
      row.sgk_device_count != null ? Number(row.sgk_device_count) : null,
    sgk_pill_prescription:
      (row.sgk_pill_prescription as boolean | null | undefined) ?? null,
    sgk_base_reimbursement:
      row.sgk_base_reimbursement != null ? Number(row.sgk_base_reimbursement) : null,
    sgk_pill_extra_amount:
      row.sgk_pill_extra_amount != null ? Number(row.sgk_pill_extra_amount) : null,
    device_brand: null,
    device_model: null,
    device_total_price: null,
    device_ear_side_summary: null,
    payment_method: (row.payment_method as PatientPaymentMethod | null) ?? null,
    sale_total_amount: (row.sale_total_amount as number | null | undefined) ?? null,
    card_fee_rate: (row.card_fee_rate as number | null | undefined) ?? null,
    card_fee_amount: (row.card_fee_amount as number | null | undefined) ?? null,
    invoice_issued: (row.invoice_issued as boolean | null | undefined) ?? null,
    invoice_issued_at: (row.invoice_issued_at as string | null | undefined) ?? null,
  };

  // v2 chaining (best-effort)
  // NOTE (v2.12): sale breakdown is NO LONGER auto-created here.
  // patient_sale_breakdown rows are edited/saved exclusively from the Payments tab.
  const saleBreakdownDraft = input.saleBreakdownDraft ?? [];
  void saleBreakdownDraft;
  const installmentPlanDraft = input.installmentPlanDraft ?? null;
  const deviceDrafts = input.deviceDrafts ?? [];
  const chargerInventoryItemId = input.chargerInventoryItemId ?? null;
  const batteryLines = input.batteryLines ?? [];

  if (installmentPlanDraft) {
    try {
      await upsertPatientInstallmentPlan({
        ...installmentPlanDraft,
        patientId: inserted.id,
      });
    } catch (err) {
      console.error(
        'STEP_CHAIN_PLAN: Failed to save installment plan draft after patient insert',
        err,
      );
    }
  }

  if (deviceDrafts.length > 0) {
    try {
      await attachDevicesToPatientFromDrafts({
        orgId,
        patientId: inserted.id,
        drafts: deviceDrafts,
        purchaseDate: input.purchaseDate,
      });
    } catch (err) {
      console.error(
        'STEP_CHAIN_DEVICE: Unexpected error while attaching device drafts after patient insert',
        err,
      );
    }
  }

  if (chargerInventoryItemId) {
    try {
      await attachChargerToPatient({
        orgId,
        patientId: inserted.id,
        chargerInventoryItemId,
        purchaseDate: input.purchaseDate,
      });
    } catch (err) {
      console.error(
        'STEP_CHAIN_CHARGER: Unexpected error while attaching charger after patient insert',
        err,
      );
    }
  }

  // Battery prescription deliveries (source of truth)
  // Condition:
  // - Device flow is 'battery_device' or 'battery_only'
  // - SGK is enabled (this table is for SGK reimbursement events)
  // - At least one battery line has qty > 0
  const isBatteryFlow =
    deviceFlowType === 'battery_device' || deviceFlowType === 'battery_only';

  if (input.sgkFlag && isBatteryFlow && (batteryLines ?? []).some((l) => qtyTotal(l) > 0)) {
    await recordBatteryPrescriptionDeliveries({
      orgId,
      patientId: inserted.id,
      batteryLines,
      prescriptionNo: input.sgkPrescriptionNo ? input.sgkPrescriptionNo.trim() : null,
    });
  }

  // Optional: link trial → patient and delete trial via RPC.
  if (options?.linkedTrialId) {
    try {
      await linkTrialToPatientAndDelete(options.linkedTrialId, inserted.id);
    } catch (err) {
      console.error('STEP_TRIAL_LINK_FAILED: link_trial_to_patient_and_delete RPC failed', {
        trialId: options.linkedTrialId,
        patientId: inserted.id,
        err,
      });
      const msg =
        err instanceof Error ? err.message : 'Unknown error while linking trial to patient.';
      throw new Error('STEP_TRIAL_LINK_FAILED: ' + msg);
    }
  }

  return inserted;
}
