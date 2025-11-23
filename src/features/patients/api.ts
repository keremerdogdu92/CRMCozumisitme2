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
} from './types';

export const PATIENTS_QUERY_KEY = ['patients'] as const;

// Payment history per patient
export const PATIENT_PAYMENTS_BY_PATIENT_QUERY_KEY = (patientId: string) =>
  ['patient-payments', patientId] as const;

// Installment plan per patient
export const PATIENT_INSTALLMENT_PLAN_BY_PATIENT_QUERY_KEY = (patientId: string) =>
  ['patient-installment-plan', patientId] as const;

export async function fetchPatients(): Promise<PatientRow[]> {
  const { data, error } = await supabaseClient
    .from('patients')
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
      payment_method,
      card_sale_total,
      card_fee_rate,
      card_fee_amount
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase patients fetch error:', error);
    throw error;
  }

  return data ?? [];
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

// Create a new patient row with org_id taken from the current profile.
export async function createPatient(input: NewPatientForm): Promise<void> {
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

  // --- Payment normalization (patients.payment_* alanları) ---

  let paymentMethod: string | null = null;
  let cardSaleTotal: number | null = null;
  let cardFeeRate: number | null = null;
  let cardFeeAmount: number | null = null;

  const rawMethod = input.paymentMethod;

  if (rawMethod && rawMethod !== '') {
    paymentMethod = rawMethod;

    if (rawMethod === 'Kredi_Kartı') {
      // Kart satışında hem satış tutarı hem de % komisyon zorunlu
      const saleTotalNum = parseMoneyToNumber(
        input.cardSaleTotal,
        'PATIENT_CARD_SALE_TOTAL',
      );

      const rateTrimmed = input.cardFeeRate.trim();
      if (!rateTrimmed) {
        throw new Error(
          'PATIENT_CARD_FEE_RATE: Kart komisyon yüzdesi (örn. 3.5) boş bırakılamaz.',
        );
      }

      const rateNorm = rateTrimmed.replace(',', '.');
      const rate = Number(rateNorm);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        throw new Error(
          'PATIENT_CARD_FEE_RATE: 0–100 arasında geçerli bir yüzde girin.',
        );
      }

      cardSaleTotal = saleTotalNum;
      cardFeeRate = Number(rate.toFixed(2));
      cardFeeAmount = Number(
        (saleTotalNum * (cardFeeRate / 100)).toFixed(2),
      );
    }
  }

  const { error: insertError } = await supabaseClient.from('patients').insert({
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
    payment_method: paymentMethod,
    card_sale_total: cardSaleTotal,
    card_fee_rate: cardFeeRate,
    card_fee_amount: cardFeeAmount,
  });

  if (insertError) {
    console.error('Failed to insert patient (STEP_INSERT):', insertError);
    throw new Error('STEP_INSERT: ' + insertError.message);
  }
}

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
 * Fetch senet payments for a single patient from meeting_payments.
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
 * React Query hook: senet ödeme geçmişi.
 */
export function usePatientPayments(patientId: string | null) {
  return useQuery({
    queryKey: patientId
      ? PATIENT_PAYMENTS_BY_PATIENT_QUERY_KEY(patientId)
      : ['patient-payments', 'none'],
    enabled: !!patientId,
    queryFn: () =>
      fetchPatientPaymentsByPatientId(patientId as string),
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
    throw new Error('PLAN_STEP_PROFILE: ' + profileError.message);
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

  const installmentAmount = Number(
    (remaining / count).toFixed(2),
  );

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
    // Insert new plan
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
    // Update existing plan
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
      // Refresh plan + payments for this patient
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
      // Listeyi de tazelemek mantıklı (kalan borç vs. ileride ana listede gösterilebilir)
      queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
    },
  });
}
