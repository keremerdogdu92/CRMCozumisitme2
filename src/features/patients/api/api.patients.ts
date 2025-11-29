// src/features/patients/api/api.patients.ts
// Patient-level mutations: create patient, update SGK fields and invoice status.

import { supabaseClient } from '../../../utils/supabaseClient';
import type {
  NewPatientForm,
  PatientRow,
  PatientSgkUpdateInput,
  PatientPaymentMethod,
} from '../types';
import { parseMoneyToNumber } from './api.core';

/**
 * Create a new patient row with org_id taken from the current profile.
 * Returns the inserted PatientRow so that callers can immediately open the detail drawer.
 *
 * Archive code generation is intentionally not handled here; it is assumed to be
 * managed by Supabase (trigger / function) at a later stage such as sale or
 * senet completion.
 */
export async function createPatient(
  input: NewPatientForm,
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
  ...
  // [DEĞİŞMEYEN KISIMLARI OLDUĞU GİBİ BIRAKIYORUM]
  ...
  if (profileError) {
    throw new Error('STEP_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    console.error('Profile org_id is missing (STEP_NO_ORG)', profile);
    throw new Error('STEP_NO_ORG: Profile org_id is missing');
  }

  const orgId = profile.org_id as string;

  // ---------------------------------------------------------------------------
  // Payment metadata on patient row
  // ---------------------------------------------------------------------------
  let payment_method: PatientPaymentMethod | null = null;
  let card_sale_total: number | null = null;
  let card_fee_rate: number | null = null;
  let card_fee_amount: number | null = null;

  if (input.paymentMethod) {
    payment_method = input.paymentMethod as PatientPaymentMethod;

    if (payment_method === 'Kredi_Kartı') {
      const saleTotalNum = parseMoneyToNumber(
        input.cardSaleTotal || '',
        'CARD_SALE_TOTAL',
      );

      const feeRateRaw = input.cardFeeRate.trim().replace(',', '.');
      const feeRateNum = Number(feeRateRaw);
      if (!Number.isFinite(feeRateNum) || feeRateNum <= 0) {
        throw new Error(
          "CARD_FEE_RATE: Geçerli bir komisyon oranı girin (0'dan büyük).",
        );
      }

      card_sale_total = saleTotalNum;
      card_fee_rate = Number(feeRateNum.toFixed(2));
      card_fee_amount = Number(
        (saleTotalNum * (feeRateNum / 100)).toFixed(2),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // SGK profile-based expected reimbursement
  // ---------------------------------------------------------------------------
  let sgk_profile: string | null = null;
  let sgk_expected_reimbursement: number | null = null;
  let sgk_expected_reimbursement_month: string | null = null;

  if (input.sgkProfileId) {
    sgk_profile = input.sgkProfileId;

    if (input.sgkExpectedReimbursement && input.sgkExpectedReimbursement.trim().length > 0) {
      sgk_expected_reimbursement = parseMoneyToNumber(
        input.sgkExpectedReimbursement,
        'SGK_EXPECTED_REIMBURSEMENT',
      );
    }

    if (input.sgkExpectedMonth && input.sgkExpectedMonth.trim().length > 0) {
      sgk_expected_reimbursement_month = input.sgkExpectedMonth.trim();
    }
  }

  const { data, error: insertError } = await supabaseClient
    .from('patients')
    .insert({
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
      card_sale_total,
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
      // SGK profile-based expected reimbursement.
      sgk_profile,
      sgk_expected_reimbursement,
      sgk_expected_reimbursement_month,
      // Invoice metadata: new patients start as "invoice not issued".
      invoice_issued: false,
      invoice_issued_at: null,
      // archive_code is intentionally omitted here; Supabase is expected
      // to assign it when sale / senet is finalized.
    })
    .select(
      `
      id,
      full_name,
      phone,
      created_at,
      last_visit_at,
      sgk_flag,
      sgk_prescription_no,
      sgk_docs_received,
      sgk_processed,
      satisfaction_10,
      sgk_prescription_received,
      sgk_recorded_to_system,
      sgk_profile,
      sgk_expected_reimbursement,
      sgk_expected_reimbursement_month,
      national_id,
      address,
      kin_phone,
      reference_id,
      archive_code,
      payment_method,
      card_sale_total,
      card_fee_rate,
      card_fee_amount,
      invoice_issued,
      invoice_issued_at
    `,
    )
    .single();

  if (insertError) {
    console.error('Failed to insert patient (STEP_INSERT):', insertError);
    throw new Error('STEP_INSERT: ' + insertError.message);
  }

  const inserted: PatientRow = {
    id: data.id as string,
    full_name: data.full_name as string,
    phone: (data.phone as string | null) ?? null,
    created_at: data.created_at as string,
    last_visit_at: (data.last_visit_at as string | null) ?? null,

    sgk_flag: (data.sgk_flag as boolean | null) ?? null,
    sgk_prescription_no:
      (data.sgk_prescription_no as string | null | undefined) ?? null,
    sgk_docs_received:
      (data.sgk_docs_received as boolean | null | undefined) ?? null,
    sgk_processed:
      (data.sgk_processed as boolean | null | undefined) ?? null,
    satisfaction_10:
      data.satisfaction_10 != null ? Number(data.satisfaction_10) : null,
    sgk_prescription_received:
      (data.sgk_prescription_received as boolean | null | undefined) ?? null,
    sgk_recorded_to_system:
      (data.sgk_recorded_to_system as boolean | null | undefined) ?? null,

    sgk_profile:
      (data.sgk_profile as string | null | undefined) ?? null,
    sgk_expected_reimbursement:
      (data.sgk_expected_reimbursement as number | null | undefined) ?? null,
    sgk_expected_reimbursement_month:
      (data.sgk_expected_reimbursement_month as string | null | undefined) ??
      null,

    national_id: (data.national_id as string | null | undefined) ?? null,
    address: (data.address as string | null | undefined) ?? null,
    kin_phone: (data.kin_phone as string | null | undefined) ?? null,

    reference_id: (data.reference_id as string | null) ?? null,
    reference_name: null,
    reference_phone: null,

    archive_code: (data.archive_code as string | null | undefined) ?? null,

    device_brand: null,
    device_model: null,
    device_total_price: null,

    payment_method:
      (data.payment_method as PatientPaymentMethod | null) ?? null,
    card_sale_total:
      (data.card_sale_total as number | null | undefined) ?? null,
    card_fee_rate:
      (data.card_fee_rate as number | null | undefined) ?? null,
    card_fee_amount:
      (data.card_fee_amount as number | null | undefined) ?? null,

    invoice_issued:
      (data.invoice_issued as boolean | null | undefined) ?? null,
    invoice_issued_at:
      (data.invoice_issued_at as string | null | undefined) ?? null,
  };

  return inserted;
}
