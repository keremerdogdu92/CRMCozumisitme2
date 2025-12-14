// src/features/patients/hooks/useNewPatientForm.ts
// Encapsulated state, validation and breakdown logic for the inline "Yeni Hasta" form.
// Keeps NewPatientFormCard lean and reusable.
//
// v2.8:
// - Adds deviceFlowType (rechargeable/battery/battery-only) and keeps it soft (no strict validation).
// - Adds optional chargerInventoryItemId for rechargeable flow (UI-guided, not required).
// - Adds batteryLines draft support (single line with box/pack/unit quantities; list can grow later).
// - Adds sgkPillPrescription flag (for battery flows) to support extra reimbursement logic later.
//
// IMPORTANT (SGK logic):
// - SGK is decoupled from device drafts.
// - sgkDeviceCount is a manual choice (1/2) managed by SGK section.
// - sgkExpectedReimbursement is treated as TOTAL and is NOT re-computed here.

import { useState, useMemo, FormEvent } from 'react';
import type {
  NewPatientForm,
  PatientPaymentMethodFormValue,
  PatientPaymentMethod,
  UpsertPatientSaleBreakdownItem,
  UpsertPatientInstallmentPlanInput,
  NewPatientDeviceDraft,
  BatteryLineDraft,
  NewPatientDeviceFlowType,
} from '../types';

type PaymentRowDraft = {
  paymentMethod: PatientPaymentMethodFormValue;
  amount: string;
  cardFeeRate: string;
};

function createEmptyPaymentRow(): PaymentRowDraft {
  return {
    paymentMethod: '',
    amount: '',
    cardFeeRate: '',
  };
}

function createEmptyDeviceDraft(): NewPatientDeviceDraft {
  return {
    inventoryItemId: null,
    side: '',
    brand: '',
    model: '',
    listPrice: '',
    salePrice: '',
    note: '',
  };
}

function createEmptyBatteryLineDraft(): BatteryLineDraft {
  return {
    batteryType: '10',
    brand: '',
    quantity: {
      box: 0,
      pack: 0,
      unit: 0,
    },
  };
}

type UseNewPatientFormArgs = {
  onSubmit: (values: NewPatientForm) => void;
  externalErrorMessage?: string;
};

export function useNewPatientForm({ onSubmit, externalErrorMessage }: UseNewPatientFormArgs) {
  const [formState, setFormState] = useState<NewPatientForm>({
    fullName: '',
    phone: '',

    // Device flow defaults to rechargeable devices.
    deviceFlowType: 'rechargeable_device',
    chargerInventoryItemId: null,
    batteryLines: [createEmptyBatteryLineDraft()],

    // SGK default false – her hasta SGK'lı gelmiyor.
    sgkFlag: false,
    sgkPrescriptionReceived: false,
    sgkRecordedToSystem: false,
    sgkProfileId: '',
    sgkExpectedReimbursement: '',
    sgkExpectedMonth: '',
    sgkPrescriptionNo: '',
    sgkDeviceCount: '1',

    // Battery-specific SGK flag (only meaningful for battery flows).
    sgkPillPrescription: false,

    paymentMethod: '',
    saleTotal: '',
    cardFeeRate: '',
    referenceId: null,
    referenceName: '',
    nationalId: '',
    kinPhone: '',
    address: '',
    saleBreakdownDraft: [],
    installmentPlanDraft: null,
    deviceDrafts: [],
  });

  const [localError, setLocalError] = useState<string | null>(null);

  // Çoklu ödeme satırları.
  const [paymentRows, setPaymentRows] = useState<PaymentRowDraft[]>([createEmptyPaymentRow()]);

  // Senet plan taslağı.
  const [senetUpfrontPaid, setSenetUpfrontPaid] = useState<string>('');
  const [senetInstallmentCount, setSenetInstallmentCount] = useState<string>('');
  const [senetFirstDueDate, setSenetFirstDueDate] = useState<string>('');
  const [senetDayOfMonth, setSenetDayOfMonth] = useState<string>('');

  // Cihaz taslakları: form en az bir cihaz satırı ile açılır.
  const [deviceDrafts, setDeviceDrafts] = useState<NewPatientDeviceDraft[]>([createEmptyDeviceDraft()]);

  const paymentsTotal = useMemo(() => {
    return paymentRows.reduce((sum, row) => {
      const val = parseMoneyLikeToNumber(row.amount);
      if (val == null || val <= 0) return sum;
      return sum + val;
    }, 0);
  }, [paymentRows]);

  const hasSenetPayment = useMemo(
    () => paymentRows.some((row) => row.paymentMethod === 'Senet'),
    [paymentRows],
  );

  const resetFormState = () => {
    setFormState({
      fullName: '',
      phone: '',

      deviceFlowType: 'rechargeable_device' as NewPatientDeviceFlowType,
      chargerInventoryItemId: null,
      batteryLines: [createEmptyBatteryLineDraft()],

      sgkFlag: false,
      sgkPrescriptionReceived: false,
      sgkRecordedToSystem: false,
      sgkProfileId: '',
      sgkExpectedReimbursement: '',
      sgkExpectedMonth: '',
      sgkPrescriptionNo: '',
      sgkDeviceCount: '1',
      sgkPillPrescription: false,

      paymentMethod: '',
      saleTotal: '',
      cardFeeRate: '',
      referenceId: null,
      referenceName: '',
      nationalId: '',
      kinPhone: '',
      address: '',
      saleBreakdownDraft: [],
      installmentPlanDraft: null,
      deviceDrafts: [],
    });
    setPaymentRows([createEmptyPaymentRow()]);
    setSenetUpfrontPaid('');
    setSenetInstallmentCount('');
    setSenetFirstDueDate('');
    setSenetDayOfMonth('');
    setDeviceDrafts([createEmptyDeviceDraft()]);
    setLocalError(null);
  };

  const handleAddPaymentRow = () => {
    setPaymentRows((rows) => [...rows, createEmptyPaymentRow()]);
  };

  const handleChangePaymentRow = (index: number, patch: Partial<PaymentRowDraft>) => {
    setPaymentRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleRemovePaymentRow = (index: number) => {
    setPaymentRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  };

  const handleAddDeviceRow = () => {
    setDeviceDrafts((rows) => [...rows, createEmptyDeviceDraft()]);
  };

  const handleChangeDeviceRow = (index: number, patch: Partial<NewPatientDeviceDraft>) => {
    setDeviceDrafts((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleRemoveDeviceRow = (index: number) => {
    setDeviceDrafts((rows) => rows.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const fullName = formState.fullName.trim();
    const tcRaw = formState.nationalId;
    const phoneRaw = formState.phone;

    if (!fullName) {
      setLocalError('Ad Soyad alanı zorunludur.');
      return;
    }
    if (!tcRaw.trim()) {
      setLocalError('T.C. Kimlik No zorunludur.');
      return;
    }
    if (!phoneRaw.trim()) {
      setLocalError('Telefon alanı zorunludur.');
      return;
    }

    if (paymentRows.length === 0) {
      setLocalError('En az bir ödeme satırı eklemeniz gerekiyor.');
      return;
    }

    const primaryPayment = paymentRows[0];
    if (!primaryPayment.paymentMethod) {
      setLocalError('İlk ödeme satırında bir ödeme şekli seçmelisiniz.');
      return;
    }
    if (!primaryPayment.amount.trim()) {
      setLocalError('İlk ödeme satırında bir tutar girmelisiniz.');
      return;
    }

    const saleTotalNumber = paymentsTotal;
    const saleTotalRaw = saleTotalNumber > 0 ? saleTotalNumber.toString() : '';

    if (!saleTotalRaw) {
      setLocalError('Toplam satış tutarı zorunludur.');
      return;
    }

    try {
      const normalizedNationalId = normalizeNationalId(tcRaw);
      const normalizedPhone = normalizePhone(phoneRaw);

      setLocalError(null);

      // Senet plan taslağı: yalnızca temel alanlar doluysa oluştur.
      const hasInstallmentDraft =
        senetInstallmentCount.trim() !== '' &&
        senetFirstDueDate.trim() !== '' &&
        senetDayOfMonth.trim() !== '';

      const installmentPlanDraft: UpsertPatientInstallmentPlanInput | null = hasInstallmentDraft
        ? {
            patientId: '', // createPatient sonrası zincirde doldurulacak.
            saleTotal: saleTotalRaw,
            upfrontPaid: senetUpfrontPaid.trim(),
            installmentCount: senetInstallmentCount.trim(),
            firstDueDate: senetFirstDueDate.trim(),
            dayOfMonth: senetDayOfMonth.trim(),
          }
        : null;

      // Çoklu ödeme satırlarından saleBreakdownDraft üret.
      const saleBreakdownDraft: UpsertPatientSaleBreakdownItem[] = paymentRows
        .filter((row) => !!row.paymentMethod && row.amount.trim().length > 0)
        .map((row) => ({
          id: undefined,
          method: row.paymentMethod as PatientPaymentMethod,
          amount: row.amount.trim(),
          note: '',
        }));

      const deviceFlowType: NewPatientDeviceFlowType =
        formState.deviceFlowType ?? 'rechargeable_device';
      const isBatteryFlow = deviceFlowType === 'battery_device' || deviceFlowType === 'battery_only';

      onSubmit({
        fullName,
        phone: normalizedPhone,

        // New flow fields (soft, no strict validation yet)
        deviceFlowType,
        chargerInventoryItemId:
          deviceFlowType === 'rechargeable_device' ? formState.chargerInventoryItemId ?? null : null,
        batteryLines: isBatteryFlow ? formState.batteryLines ?? [] : [],
        sgkPillPrescription: formState.sgkFlag && isBatteryFlow ? !!formState.sgkPillPrescription : false,

        sgkFlag: formState.sgkFlag,
        sgkPrescriptionReceived: formState.sgkFlag ? formState.sgkPrescriptionReceived : false,
        sgkRecordedToSystem: formState.sgkFlag ? formState.sgkRecordedToSystem : false,

        // SGK values are authored by the SGK UI section:
        // - sgkDeviceCount is manual
        // - sgkExpectedReimbursement is TOTAL
        sgkProfileId: formState.sgkFlag ? formState.sgkProfileId : '',
        sgkExpectedReimbursement: formState.sgkFlag ? (formState.sgkExpectedReimbursement ?? '') : '',
        sgkExpectedMonth: formState.sgkFlag ? (formState.sgkExpectedMonth ?? '') : '',
        sgkPrescriptionNo: formState.sgkFlag ? (formState.sgkPrescriptionNo ?? '').trim() : '',
        sgkDeviceCount: formState.sgkFlag ? (formState.sgkDeviceCount ?? '1') : '1',

        paymentMethod: primaryPayment.paymentMethod,
        saleTotal: saleTotalRaw,
        cardFeeRate: primaryPayment.paymentMethod === 'Kredi_Kartı' ? primaryPayment.cardFeeRate : '',

        referenceId: formState.referenceId,
        referenceName: formState.referenceName,
        nationalId: normalizedNationalId,
        kinPhone: formState.kinPhone.trim(),
        address: formState.address.trim(),

        saleBreakdownDraft,
        installmentPlanDraft,

        // Keep device drafts separate state until UI refactor is complete.
        deviceDrafts,
      });

      // İstersen çağıran tarafta success sonrası resetFormState() çalıştırabilirsin.
      // resetFormState();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Form doğrulaması sırasında hata oluştu.';
      setLocalError(message);
    }
  };

  const combinedError = localError || externalErrorMessage || undefined;

  return {
    formState,
    setFormState,

    paymentRows,
    handleAddPaymentRow,
    handleChangePaymentRow,
    handleRemovePaymentRow,

    deviceDrafts,
    handleAddDeviceRow,
    handleChangeDeviceRow,
    handleRemoveDeviceRow,

    senetUpfrontPaid,
    setSenetUpfrontPaid,
    senetInstallmentCount,
    setSenetInstallmentCount,
    senetFirstDueDate,
    setSenetFirstDueDate,
    senetDayOfMonth,
    setSenetDayOfMonth,

    paymentsTotal,
    hasSenetPayment,
    handleSubmit,
    combinedError,
    resetFormState,
  };
}

// --- Pure helpers (kept here for reuse & testability) ---

// Normalize phone for storage / future WhatsApp links.
// - Accepts:
//   * +<country><number> (e.g. +491234...)
//   * 00<country><number> (converted to '+')
//   * TR local numbers (05XXXXXXXXX or 5XXXXXXXXX etc.)
// - Returns E.164-like string starting with '+'.
function normalizePhone(input: string): string {
  const raw = input.trim();
  if (!raw) {
    throw new Error('Telefon boş olamaz.');
  }

  // Remove common separators but keep leading '+' or '00'
  const v = raw.replace(/[()\s-]/g, '');

  // Case 1: starts with '+'
  if (v.startsWith('+')) {
    const digits = v.slice(1).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      throw new Error('Telefon numarası geçerli bir uluslararası formatta değil.');
    }
    return `+${digits}`;
  }

  // Case 2: starts with '00' -> convert to '+'
  if (v.startsWith('00')) {
    const digits = v.slice(2).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      throw new Error('Telefon numarası geçerli bir uluslararası formatta değil.');
    }
    return `+${digits}`;
  }

  // Case 3: treat as TR number.
  const digits = v.replace(/\D/g, '');

  if (digits.length === 10) {
    if (digits.startsWith('0')) {
      return `+90${digits.slice(1)}`;
    }
    return `+90${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return `+90${digits.slice(1)}`;
  }

  throw new Error('Telefon numarası 10–11 haneli TR veya geçerli uluslararası formatta olmalıdır.');
}

// Normalize T.C.: keep digits only and require 11 digits.
function normalizeNationalId(input: string): string {
  const digits = input.trim().replace(/\D/g, '');
  if (digits.length !== 11) {
    throw new Error('T.C. Kimlik No 11 haneli olmalıdır.');
  }
  return digits;
}

// Money helpers (TR format destekli).
function parseMoneyLikeToNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return num;
}

export function formatCurrencyTry(amount: number | null): string {
  if (amount == null) return '-';
  try {
    return amount.toLocaleString('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${amount}`;
  }
}
