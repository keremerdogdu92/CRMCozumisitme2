// src/features/patients/api.ts
// Supabase API helpers and React Query keys for the Patients feature.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type {
  NewPatientForm,
  PatientRow,
  PatientSgkUpdateInput,
  PatientPaymentRow,
  PatientInstallmentPlanRow,
  UpsertPatientInstallmentPlanInput,
  PatientPaymentMethod,
} from './types';

export const PATIENTS_QUERY_KEY = ['patients'] as const;

// Payment history per patient
export const PATIENT_PAYMENTS_BY_PATIENT_QUERY_KEY = (patientId: string) =>
  ['patient-payments', patientId] as const;

// Installment plan per patient
export const PATIENT_INSTALLMENT_PLAN_BY_PATIENT_QUERY_KEY = (
  patientId: string,
) => ['patient-installment-plan', patientId] as const;

/**
 * Patients attached to a specific reference.
 * Used by ReferenceDetailDrawer to list "Hastalar".
 */
export const PATIENTS_BY_REFERENCE_QUERY_KEY = (referenceId: string) =>
  ['patients-by-reference', referenceId] as const;

export interface PatientForReference {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  last_visit_at: string | null;
}

export async function fetchPatientsByReferenceId(
  referenceId: string,
): Promise<PatientForReference[]> {
  if (!referenceId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('patients')
    .select(
      `
      id,
      full_name,
      phone,
      created_at,
      last_visit_at
    `,
    )
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(
      'Supabase patients-by-reference fetch error:',
      error,
    );
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    full_name: row.full_name as string,
    phone: (row.phone as string | null) ?? null,
    created_at: row.created_at as string,
    last_visit_at: (row.last_visit_at as string | null) ?? null,
  }));
}

export async function fetchPatients(): Promise<PatientRow[]> {
  const { data, error } = await supabaseClient
    .from('patient_list_with_device')
    .select(
      `
      id,
      full_name,
      phone,
      created_at,
      last_visit_at,
      sgk_flag,
      sgk_prescription_received,
      sgk_recorded_to_system,
      reference_id,
      payment_method,
      card_sale_total,
      card_fee_rate,
      card_fee_amount,
      device_brand,
      device_model,
      device_total_price,
      reference_name,
      reference_phone
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase patients fetch error:', error);
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    full_name: row.full_name as string,
    phone: (row.phone as string | null) ?? null,
    created_at: row.created_at as string,
    last_visit_at: (row.last_visit_at as string | null) ?? null,
    sgk_flag: (row.sgk_flag as boolean | null) ?? null,
    sgk_prescription_received:
      (row.sgk_prescription_received as boolean | null) ?? null,
    sgk_recorded_to_system:
      (row.sgk_recorded_to_system as boolean | null) ?? null,
    reference_id: (row.reference_id as string | null) ?? null,
    reference_name:
      (row.reference_name as string | null | undefined) ?? null,
    reference_phone:
      (row.reference_phone as string | null | undefined) ?? null,
    device_brand:
      (row.device_brand as string | null | undefined) ?? null,
    device_model:
      (row.device_model as string | null | undefined) ?? null,
    device_total_price:
      (row.device_total_price as number | null | undefined) ?? null,
    payment_method:
      (row.payment_method as PatientPaymentMethod | null) ?? null,
    card_sale_total:
      (row.card_sale_total as number | null | undefined) ?? null,
    card_fee_rate:
      (row.card_fee_rate as number | null | undefined) ?? null,
    card_fee_amount:
      (row.card_fee_amount as number | null | undefined) ?? null,
  })) as PatientRow[];
}

/**
 * Lightweight search for patients by full_name.
 * Used by the Meetings subject picker to attach meetings to existing patients.
 */
export interface PatientLite {
  id: string;
  full_name: string;
}

export async function searchPatientsByName(
  query: string,
  limit = 10,
): Promise<PatientLite[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('patients')
    .select('id, full_name')
    .ilike('full_name', `%${trimmed}%`)
    .order('full_name', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Supabase patients search error:', error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    full_name: row.full_name as string,
  }));
}

/**
 * Parse a money-like string ("20 000", "20.000", "20000,50") into number.
 */
function parseMoneyToNumber(raw: string, fieldCode: string): number {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(
      `${fieldCode}: Boş bırakılamaz, geçerli bir tutar girin.`,
    );
  }

  const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
  const value = Number(normalized);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `${fieldCode}: Geçerli bir tutar girin (0'dan büyük olmalı).`,
    );
  }

  return Number(value.toFixed(2));
}

/**
 * Create a new patient row with org_id taken from the current profile.
 * Returns the inserted PatientRow so that callers can immediately open the detail drawer.
 */
export async function createPatient(input: NewPatientForm): Promise<PatientRow> {
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

  // Payment metadata on patient row
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
          'CARD_FEE_RATE: Geçerli bir komisyon oranı girin (0\'dan büyük).',
        );
      }

      card_sale_total = saleTotalNum;
      card_fee_rate = Number(feeRateNum.toFixed(2));
      card_fee_amount = Number(
        (saleTotalNum * (feeRateNum / 100)).toFixed(2),
      );
    }
  }

  const { data, error: insertError } = await supabaseClient
    .from('patients')
    .insert({
      org_id: profile.org_id,
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
    })
    .select(
      `
      id,
      full_name,
      phone,
      created_at,
      last_visit_at,
      sgk_flag,
      sgk_prescription_received,
      sgk_recorded_to_system,
      reference_id,
      payment_method,
      card_sale_total,
      card_fee_rate,
      card_fee_amount
    `,
    )
    .single();

  if (insertError) {
    console.error('Failed to insert patient (STEP_INSERT):', insertError);
    throw new Error('STEP_INSERT: ' + insertError.message);
  }

  // New patient won't have device or reference data yet; keep them null.
  return {
    id: data.id as string,
    full_name: data.full_name as string,
    phone: (data.phone as string | null) ?? null,
    created_at: data.created_at as string,
    last_visit_at: (data.last_visit_at as string | null) ?? null,
    sgk_flag: (data.sgk_flag as boolean | null) ?? null,
    sgk_prescription_received:
      (data.sgk_prescription_received as boolean | null) ?? null,
    sgk_recorded_to_system:
      (data.sgk_recorded_to_system as boolean | null) ?? null,
    reference_id: (data.reference_id as string | null) ?? null,
    reference_name: null,
    reference_phone: null,
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
  };
}

// ... dosyanın geri kalanı (SGK update, payments, installment plan) senin attığın haliyle aynen devam ediyor ...


// Update SGK-related fields for a given patient.
export async function updatePatientSgkFields(
  params: PatientSgkUpdateInput,
): Promise<void> {
  const { id, sgkFlag, sgkPrescriptionReceived, sgkRecordedToSystem } = params;

  const { error } = await supabaseClient
    .from('patients')
    .update({
      sgk_flag: sgkFlag,
      sgk_prescription_received: sgkFlag ? sgkPrescriptionReceived : false,
      sgk_recorded_to_system: sgkFlag ? sgkRecordedToSystem : false,
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
 * Fetch payments for a single patient from meeting_payments.
 */
export async function fetchPatientPaymentsByPatientId(
  patientId: string,
): Promise<PatientPaymentRow[]> {
  if (!patientId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('meeting_payments')
    .select(
      `
      id,
      meeting_id,
      patient_id,
      amount,
      method,
      note,
      created_at
    `,
    )
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase patient payments fetch error:', error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    meeting_id: (row.meeting_id as string | null) ?? null,
    patient_id: row.patient_id as string,
    amount: Number(row.amount),
    method: (row.method as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    created_at: row.created_at as string,
  }));
}

/**
 * React Query hook: payment history.
 */
export function usePatientPayments(patientId: string | null) {
  return useQuery({
    queryKey: patientId
      ? PATIENT_PAYMENTS_BY_PATIENT_QUERY_KEY(patientId)
      : ['patient-payments', 'none'],
    enabled: !!patientId,
    queryFn: () => fetchPatientPaymentsByPatientId(patientId as string),
  });
}

/**
 * Fetch active installment plan for a single patient.
 */
export async function fetchActivePatientInstallmentPlan(
  patientId: string,
): Promise<PatientInstallmentPlanRow | null> {
  if (!patientId) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from('patient_installment_plans')
    .select(
      `
      id,
      org_id,
      patient_id,
      sale_total,
      upfront_paid,
      installment_count,
      installment_amount,
      first_due_date,
      day_of_month,
      status,
      created_at,
      updated_at
    `,
    )
    .eq('patient_id', patientId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error(
      'Supabase patient installment plan fetch error:',
      error,
    );
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id as string,
    org_id: data.org_id as string,
    patient_id: data.patient_id as string,
    sale_total: Number(data.sale_total),
    upfront_paid: Number(data.upfront_paid),
    installment_count: Number(data.installment_count),
    installment_amount: Number(data.installment_amount),
    first_due_date: data.first_due_date as string,
    day_of_month: Number(data.day_of_month),
    status: (data.status as string) ?? 'active',
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

/**
 * React Query hook: active senet plan for a patient.
 */
export function usePatientInstallmentPlan(patientId: string | null) {
  return useQuery({
    queryKey: patientId
      ? PATIENT_INSTALLMENT_PLAN_BY_PATIENT_QUERY_KEY(patientId)
      : ['patient-installment-plan', 'none'],
    enabled: !!patientId,
    queryFn: () =>
      fetchActivePatientInstallmentPlan(patientId as string),
  });
}

/**
 * Upsert (create/update) a patient installment plan.
 * Rule: her org + patient için en fazla 1 aktif plan.
 */
export async function upsertPatientInstallmentPlan(
  input: UpsertPatientInstallmentPlanInput,
): Promise<void> {
  const {
    patientId,
    saleTotal,
    upfrontPaid,
    installmentCount,
    firstDueDate,
    dayOfMonth,
  } = input;

  if (!patientId) {
    throw new Error('PLAN_STEP_PATIENT_REQUIRED: Hasta seçili değil.');
  }

  // Current user
  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();
  if (userError) {
    console.error('Failed to get current user (PLAN_STEP_USER):', userError);
    throw new Error('PLAN_STEP_USER: ' + userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('PLAN_STEP_USER: User not authenticated');
  }

  // Profile → org_id
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error(
      'Failed to load profile for org_id (PLAN_STEP_PROFILE):',
      profileError,
    );
  }

  if (!profile?.org_id) {
    console.error('Profile org_id is missing (PLAN_STEP_NO_ORG)', profile);
    throw new Error('PLAN_STEP_NO_ORG: Profile org_id is missing');
  }

  const orgId = profile.org_id as string;

  // Parse numeric fields
  const saleTotalNum = parseMoneyToNumber(saleTotal, 'PLAN_SALE_TOTAL');
  const upfrontPaidNum =
    upfrontPaid.trim() === ''
      ? 0
      : parseMoneyToNumber(upfrontPaid, 'PLAN_UPFRONT');

  if (upfrontPaidNum > saleTotalNum) {
    throw new Error(
      'PLAN_UPFRONT_TOO_HIGH: Peşinat toplam satış fiyatından büyük olamaz.',
    );
  }

  const count = Number.parseInt(installmentCount.trim(), 10);
  if (!Number.isFinite(count) || count <= 0) {
    throw new Error(
      'PLAN_INSTALLMENT_COUNT: Geçerli bir taksit sayısı girin (1 veya üzeri).',
    );
  }

  if (!firstDueDate.trim()) {
    throw new Error(
      'PLAN_FIRST_DUE_DATE: İlk ödeme tarihi seçilmelidir.',
    );
  }

  const dayNum = Number.parseInt(dayOfMonth.trim(), 10);
  if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > 31) {
    throw new Error(
      'PLAN_DAY_OF_MONTH: Ayın kaçıncı günü 1–31 arasında olmalıdır.',
    );
  }

  const remaining = saleTotalNum - upfrontPaidNum;
  if (remaining <= 0) {
    throw new Error(
      'PLAN_REMAINING_NONPOSITIVE: Peşinat sonrası kalan tutar 0’dan büyük olmalıdır.',
    );
  }

  const installmentAmount = Number((remaining / count).toFixed(2));

  // Check for existing active plan
  const { data: existing, error: existingError } = await supabaseClient
    .from('patient_installment_plans')
    .select('id')
    .eq('org_id', orgId)
    .eq('patient_id', patientId)
    .eq('status', 'active')
    .maybeSingle();

  if (existingError) {
    console.error(
      'PLAN_STEP_EXISTING_FETCH: Failed to load existing plan',
      existingError,
    );
    throw new Error(
      'PLAN_STEP_EXISTING_FETCH: ' + existingError.message,
    );
  }

  if (!existing) {
    const { error: insertError } = await supabaseClient
      .from('patient_installment_plans')
      .insert({
        org_id: orgId,
        patient_id: patientId,
        sale_total: saleTotalNum,
        upfront_paid: upfrontPaidNum,
        installment_count: count,
        installment_amount: installmentAmount,
        first_due_date: firstDueDate,
        day_of_month: dayNum,
        status: 'active',
        created_by: user.id,
      });

    if (insertError) {
      console.error(
        'PLAN_STEP_INSERT: Failed to insert installment plan',
        insertError,
      );
      throw new Error('PLAN_STEP_INSERT: ' + insertError.message);
    }
  } else {
    const { error: updateError } = await supabaseClient
      .from('patient_installment_plans')
      .update({
        sale_total: saleTotalNum,
        upfront_paid: upfrontPaidNum,
        installment_count: count,
        installment_amount: installmentAmount,
        first_due_date: firstDueDate,
        day_of_month: dayNum,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) {
      console.error(
        'PLAN_STEP_UPDATE: Failed to update installment plan',
        updateError,
      );
      throw new Error('PLAN_STEP_UPDATE: ' + updateError.message);
    }
  }
}

/**
 * React Query mutation: upsert senet plan.
 */
export function useUpsertPatientInstallmentPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: upsertPatientInstallmentPlan,
    onSuccess: (_data, variables) => {
      if (variables.patientId) {
        queryClient.invalidateQueries({
          queryKey: PATIENT_INSTALLMENT_PLAN_BY_PATIENT_QUERY_KEY(
            variables.patientId,
          ),
        });
        queryClient.invalidateQueries({
          queryKey: PATIENT_PAYMENTS_BY_PATIENT_QUERY_KEY(
            variables.patientId,
          ),
        });
      }
      queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
    },
  });
}
