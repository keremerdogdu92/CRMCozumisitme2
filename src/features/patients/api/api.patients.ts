// src/features/patients/api/api.patients.ts
// Patient-level mutations: create patient, update SGK fields and invoice status.

import { supabaseClient } from '../../../utils/supabaseClient';
import type {
  NewPatientForm,
  PatientRow,
  PatientSgkUpdateInput,
  PatientPaymentMethod,
  NewPatientDeviceDraft,
} from '../types';
import { parseMoneyToNumber } from './api.core';
import { savePatientSaleBreakdown } from './api.saleBreakdown';
import { upsertPatientInstallmentPlan } from './api.payments';

export type CreatePatientOptions = {
  /**
   * If true, the patient will be created as "invoice already issued".
   * Used mainly for CSV imports where historical patients are loaded.
   */
  setInvoiceIssuedTrue?: boolean;
};

/**
 * Best-effort helper to attach inventory_items to a patient based on
 * device drafts collected in the "New Patient" form.
 *
 * Current matching strategy (v1):
 * - For each draft row:
 *   - brand + model are trimmed; if either is empty, row is skipped.
 *   - We search inventory_items for the first row with:
 *       org_id = orgId
 *       status = 'in_stock'
 *       brand  = draft.brand
 *       model  = draft.model
 *   - If found, we mark it as sold to this patient:
 *       sold_patient_id = patientId
 *       status          = 'sold'
 *       sold_at         = now()
 *       ear_side        = draft.side (right/left/bilateral) or NULL
 *
 * Notes:
 * - This is intentionally "first free match" logic. When the UI later exposes
 *   barcode/serial selection, we can extend this to match by barcode/serial.
 * - All errors are logged but DO NOT cause createPatient to fail.
 */
async function attachDevicesToPatientFromDrafts(params: {
  orgId: string;
  patientId: string;
  drafts: NewPatientDeviceDraft[];
}): Promise<void> {
  const { orgId, patientId, drafts } = params;

  if (!drafts || drafts.length === 0) return;

  for (const draft of drafts) {
    const brand = (draft.brand ?? '').trim();
    const model = (draft.model ?? '').trim();

    // Brand + model are minimum requirement to attempt a match.
    if (!brand || !model) {
      continue;
    }

    try {
      const { data, error } = await supabaseClient
        .from('inventory_items')
        .select('id, ear_side, status')
        .eq('org_id', orgId)
        .eq('brand', brand)
        .eq('model', model)
        .eq('status', 'in_stock')
        .limit(1);

      if (error) {
        console.error(
          'STEP_DEVICE_ATTACH_QUERY: Failed to query inventory_items for device draft',
          { orgId, brand, model, error },
        );
        continue;
      }

      const row = (data ?? [])[0] as { id: string } | undefined;
      if (!row) {
        console.warn(
          'STEP_DEVICE_ATTACH_NO_MATCH: No in_stock inventory item found for draft',
          { orgId, brand, model },
        );
        continue;
      }

      const side =
        draft.side === 'right' ||
        draft.side === 'left' ||
        draft.side === 'bilateral'
          ? draft.side
          : null;

      const { error: updateError } = await supabaseClient
        .from('inventory_items')
        .update({
          sold_patient_id: patientId,
          sold_at: new Date().toISOString(),
          status: 'sold',
          ear_side: side,
        })
        .eq('id', row.id);

      if (updateError) {
        console.error(
          'STEP_DEVICE_ATTACH_UPDATE: Failed to update inventory_items row for device draft',
          { inventoryItemId: row.id, patientId, updateError },
        );
        continue;
      }
    } catch (err) {
      console.error(
        'STEP_DEVICE_ATTACH_UNEXPECTED: Unexpected error while attaching device draft',
        { orgId, patientId, brand, model, err },
      );
      continue;
    }
  }
}

/**
 * Create a new patient row with org_id taken from the current profile.
 * Returns the inserted PatientRow so that callers can immediately open the detail drawer.
 *
 * Archive code generation is intentionally not handled here; it is assumed to be
 * managed by Supabase (trigger / function) at a later stage such as sale or
 * senet completion.
 *
 * v2: Supports optional financial drafts from NewPatientForm:
 * - input.saleBreakdownDraft → patient_sale_breakdown rows (best-effort)
 * - input.installmentPlanDraft → patient_installment_plans row (best-effort)
 * - input.deviceDrafts → inventory_items rows sold to patient (best-effort)
 *
 * Önemli not:
 * - Finans ve cihaz taslakları başarısız olursa hasta kaydı yine de oluşturulur.
 * - Hatalar console.error ile loglanır, createPatient dışarıya throw etmez.
 * - Kullanıcı daha sonra Hasta Detay → Ödemeler / Cihazlar sekmelerinden
 *   breakdown/plan/cihazları düzeltebilir.
 */
export async function createPatient(
  input: NewPatientForm,
  options?: CreatePatientOptions,
): Promise<PatientRow> {
  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();

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
    console.error(
      'Failed to load profile for org_id (STEP_PROFILE):',
      profileError,
    );
    throw new Error('STEP_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    console.error('Profile org_id is missing (STEP_NO_ORG)', profile);
    throw new Error('STEP_NO_ORG: Profile org_id is missing');
  }

  const orgId = profile.org_id as string;

  // ---------------------------------------------------------------------------
  // Legacy sale date override (mainly for CSV imports)
  // ---------------------------------------------------------------------------
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
        console.warn(
          'LEGACY_SALE_DATE_INVALID: Unable to parse legacy sale date on createPatient',
          { raw },
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Payment metadata on patient row
  // ---------------------------------------------------------------------------
  if (!input.paymentMethod) {
    throw new Error('PAYMENT_METHOD: Ödeme şekli zorunludur.');
  }

  const saleTotalRaw = input.saleTotal?.trim() ?? '';
  if (!saleTotalRaw) {
    throw new Error('SALE_TOTAL_AMOUNT: Toplam satış tutarı zorunludur.');
  }

  let payment_method: PatientPaymentMethod | null = null;
  let sale_total_amount: number | null = null;
  let card_fee_rate: number | null = null;
  let card_fee_amount: number | null = null;

  // Toplam gerçek satış, tüm ödeme türleri için zorunlu
  sale_total_amount = parseMoneyToNumber(
    saleTotalRaw,
    'SALE_TOTAL_AMOUNT',
  );

  if (input.paymentMethod) {
    payment_method = input.paymentMethod as PatientPaymentMethod;

    if (payment_method === 'Kredi_Kartı') {
      const feeRateRaw = input.cardFeeRate.trim().replace(',', '.');
      const feeRateNum = Number(feeRateRaw);

      if (!Number.isFinite(feeRateNum) || feeRateNum <= 0) {
        throw new Error(
          "CARD_FEE_RATE: Geçerli bir komisyon oranı girin (0'dan büyük).",
        );
      }

      card_fee_rate = Number(feeRateNum.toFixed(2));

      if (sale_total_amount != null) {
        card_fee_amount = Number(
          (sale_total_amount * (feeRateNum / 100)).toFixed(2),
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // SGK profile-based expected reimbursement (optional)
  // ---------------------------------------------------------------------------
  let sgk_profile: string | null = null;
  let sgk_expected_reimbursement: number | null = null;
  let sgk_expected_reimbursement_month: string | null = null;

  if (input.sgkFlag) {
    // Code of the SGK profile (e.g. 'SGK_0_4_CALISAN')
    if (input.sgkProfileId && input.sgkProfileId.trim().length > 0) {
      sgk_profile = input.sgkProfileId.trim();
    }

    // Expected reimbursement as money-like string ("6104,45")
    if (input.sgkExpectedReimbursement) {
      sgk_expected_reimbursement = parseMoneyToNumber(
        input.sgkExpectedReimbursement,
        'SGK_EXPECTED_REIMBURSEMENT',
      );
    }

    // Expected reimbursement month – always persisted as the 15th of that month.
    // UI sends "yyyy-MM"; we convert to "yyyy-MM-15".
    if (input.sgkExpectedMonth) {
      const [yearStr, monthStr] = input.sgkExpectedMonth.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);

      if (
        !Number.isFinite(year) ||
        !Number.isFinite(month) ||
        month < 1 ||
        month > 12
      ) {
        throw new Error(
          'SGK_EXPECTED_MONTH: Geçerli bir ay seçin (yyyy-AA).',
        );
      }

      // Use UTC to avoid timezone shifts and always store the 15th.
      const date = new Date(Date.UTC(year, month - 1, 15));
      sgk_expected_reimbursement_month = date.toISOString().slice(0, 10); // "yyyy-MM-15"
    }
  }

  // Decide initial invoice state.
  const shouldMarkInvoiceIssued = options?.setInvoiceIssuedTrue === true;
  const nowIso = new Date().toISOString();
  const invoiceIssuedAt = shouldMarkInvoiceIssued
    ? legacyInvoiceIssuedAt ?? nowIso
    : null;

  // Build insert payload so we can optionally override created_at.
  const insertPayload: Record<string, any> = {
    org_id: orgId,
    full_name: input.fullName.trim(),
    phone: input.phone.trim() || null,
    sgk_flag: input.sgkFlag,
    sgk_prescription_received: input.sgkFlag
      ? input.sgkPrescriptionReceived
      : false,
    sgk_recorded_to_system: input.sgkFlag
      ? input.sgkRecordedToSystem
      : false,
    reference_id: input.referenceId,
    payment_method,
    sale_total_amount,
    card_fee_rate,
    card_fee_amount,

    // Extended fields: initial values from the new patient form.
    sgk_prescription_no: null,
    sgk_docs_received: null,
    sgk_processed: null,
    satisfaction_10: null,
    national_id: input.nationalId.trim() || null,
    address: input.address.trim() || null,
    kin_phone: input.kinPhone.trim() || null,

    // SGK profile-based reimbursement metadata.
    sgk_profile,
    sgk_expected_reimbursement,
    sgk_expected_reimbursement_month,

    // Invoice metadata.
    invoice_issued: shouldMarkInvoiceIssued,
    invoice_issued_at: invoiceIssuedAt,

    // archive_code is intentionally omitted here; Supabase is expected
    // to assign it when sale / senet is finalized.
  };

  if (legacyCreatedAt) {
    // If legacy sale date is provided and valid, backfill created_at as well.
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
        'invoice_issued',
        'invoice_issued_at',
      ].join(', '),
    )
    .single();

  if (insertError) {
    console.error('Failed to insert patient (STEP_INSERT):', insertError);
    throw new Error('STEP_INSERT: ' + insertError.message);
  }

  const row: any = data;

  const inserted: PatientRow = {
    id: row.id as string,
    full_name: row.full_name as string,
    phone: (row.phone as string | null) ?? null,
    created_at: row.created_at as string,
    last_visit_at: (row.last_visit_at as string | null) ?? null,

    sgk_flag: (row.sgk_flag as boolean | null) ?? null,
    sgk_prescription_no:
      (row.sgk_prescription_no as string | null | undefined) ?? null,
    sgk_docs_received:
      (row.sgk_docs_received as boolean | null | undefined) ?? null,
    sgk_processed:
      (row.sgk_processed as boolean | null | undefined) ?? null,
    satisfaction_10:
      row.satisfaction_10 != null ? Number(row.satisfaction_10) : null,
    sgk_prescription_received:
      (row.sgk_prescription_received as boolean | null | undefined) ?? null,
    sgk_recorded_to_system:
      (row.sgk_recorded_to_system as boolean | null | undefined) ?? null,

    national_id: (row.national_id as string | null | undefined) ?? null,
    address: (row.address as string | null | undefined) ?? null,
    kin_phone: (row.kin_phone as string | null | undefined) ?? null,

    reference_id: (row.reference_id as string | null) ?? null,
    reference_name: null,
    reference_phone: null,

    archive_code: (row.archive_code as string | null | undefined) ?? null,

    // SGK profile-based reimbursement metadata
    sgk_profile: (row.sgk_profile as string | null | undefined) ?? null,
    sgk_expected_reimbursement:
      row.sgk_expected_reimbursement != null
        ? Number(row.sgk_expected_reimbursement)
        : null,
    sgk_expected_reimbursement_month:
      (row.sgk_expected_reimbursement_month as
        | string
        | null
        | undefined) ?? null,

    // Device summary – new patient has no linked inventory devices yet.
    device_brand: null,
    device_model: null,
    device_total_price: null,
    device_ear_side_summary: null,

    payment_method: (row.payment_method as PatientPaymentMethod | null) ?? null,
    sale_total_amount:
      (row.sale_total_amount as number | null | undefined) ?? null,
    card_fee_rate: (row.card_fee_rate as number | null | undefined) ?? null,
    card_fee_amount: (row.card_fee_amount as number | null | undefined) ?? null,

    invoice_issued: (row.invoice_issued as boolean | null | undefined) ?? null,
    invoice_issued_at:
      (row.invoice_issued_at as string | null | undefined) ?? null,
  };

  // ---------------------------------------------------------------------------
  // v2 financial & device chaining (best-effort, non-blocking):
  // - Ödeme dağılımı (patient_sale_breakdown)
  // - Senet planı (patient_installment_plans)
  // - Stok cihazlarının hastaya bağlanması (inventory_items)
  // ---------------------------------------------------------------------------
  const saleBreakdownDraft = input.saleBreakdownDraft ?? [];
  const installmentPlanDraft = input.installmentPlanDraft ?? null;
  const deviceDrafts = input.deviceDrafts ?? [];

  if (saleBreakdownDraft.length > 0) {
    try {
      await savePatientSaleBreakdown({
        patientId: inserted.id,
        items: saleBreakdownDraft,
      });
    } catch (err) {
      console.error(
        'STEP_CHAIN_BREAKDOWN: Failed to save sale breakdown draft after patient insert',
        err,
      );
      // Intentionally NOT throwing: patient is created, user can fix breakdown later.
    }
  }

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
      // Intentionally NOT throwing: patient is created, user can fix plan later.
    }
  }

  if (deviceDrafts.length > 0) {
    try {
      await attachDevicesToPatientFromDrafts({
        orgId,
        patientId: inserted.id,
        drafts: deviceDrafts,
      });
    } catch (err) {
      console.error(
        'STEP_CHAIN_DEVICE: Unexpected error while attaching device drafts after patient insert',
        err,
      );
      // Yine throw etmiyoruz; hasta kaydı tamam, cihaz eşlemesi sonradan düzeltilebilir.
    }
  }

  return inserted;
}

/**
 * Update SGK-related fields for a given patient.
 */
export async function updatePatientSgkFields(
  params: PatientSgkUpdateInput,
): Promise<void> {
  const {
    id,
    sgkFlag,
    sgkPrescriptionReceived,
    sgkRecordedToSystem,
    sgkPrescriptionNo,
  } = params;

  const { error } = await supabaseClient
    .from('patients')
    .update({
      sgk_flag: sgkFlag,
      sgk_prescription_received: sgkFlag
        ? sgkPrescriptionReceived
        : false,
      sgk_recorded_to_system: sgkFlag ? sgkRecordedToSystem : false,
      sgk_prescription_no: sgkPrescriptionNo.trim() || null,
    })
    .eq('id', id);

  if (error) {
    console.error(
      'Failed to update patient SGK fields (STEP_UPDATE_SGK):',
      error,
    );
    throw new Error('STEP_UPDATE_SGK: ' + error.message);
  }
}

/**
 * Update invoice status for a given patient.
 * Returns the latest invoice_issued/invoice_issued_at values.
 */
export async function updatePatientInvoiceStatus(params: {
  id: string;
  invoiceIssued: boolean;
}): Promise<{
  invoice_issued: boolean;
  invoice_issued_at: string | null;
}> {
  const { id, invoiceIssued } = params;
  const nextIssuedAt = invoiceIssued ? new Date().toISOString() : null;

  const { data, error } = await supabaseClient
    .from('patients')
    .update({
      invoice_issued: invoiceIssued,
      invoice_issued_at: invoiceIssued ? nextIssuedAt : null,
    })
    .eq('id', id)
    .select('invoice_issued, invoice_issued_at')
    .single();

  if (error) {
    console.error(
      'Failed to update patient invoice status (STEP_UPDATE_INVOICE):',
      error,
    );
  }
  if (error) {
    throw new Error('STEP_UPDATE_INVOICE: ' + error.message);
  }

  return {
    invoice_issued: !!(data as any).invoice_issued,
    invoice_issued_at:
      ((data as any).invoice_issued_at as string | null) ?? null,
  };
}
