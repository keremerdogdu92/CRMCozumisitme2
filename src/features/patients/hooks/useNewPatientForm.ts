// src/features/patients/hooks/useNewPatientForm.ts
// Encapsulated state and validation logic for the inline "Yeni Hasta" form.
// Keeps NewPatientFormCard lean by moving all business logic into a reusable hook.

import { useState, FormEvent } from 'react';
import type {
  NewPatientForm,
  PatientPaymentMethodFormValue,
  UpsertPatientInstallmentPlanInput,
  NewPatientDeviceDraft,
} from '../types';

// Helper: empty device draft used in the new patient form.
// We always start with at least one device row ready to fill.
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

type UseNewPatientFormArgs = {
  onSubmit: (values: NewPatientForm) => void;
  externalErrorMessage?: string;
};

export function useNewPatientForm({
  onSubmit,
  externalErrorMessage,
}: UseNewPatientFormArgs) {
  const [formState, setFormState] = useState<NewPatientForm>({
    fullName: '',
    phone: '',
    sgkFlag: true,
    sgkPrescriptionReceived: false,
    sgkRecordedToSystem: false,
    sgkProfileId: '',
    sgkExpectedReimbursement: '',
    sgkExpectedMonth: '',
    sgkPrescriptionNo: '',
    paymentMethod: '',
    saleTotal: '',
    cardFeeRate: '',
    referenceId: null,
    referenceName: '',
    nationalId: '',
    kinPhone: '',
    address: '',
    // Financial draft fields are optional; initialize as empty.
    saleBreakdownDraft: [],
    installmentPlanDraft: null,
    deviceDrafts: [],
  });

  const [localError, setLocalError] = useState<string | null>(null);

  // Draft: senet plan fields for this new patient.
  const [senetUpfrontPaid, setSenetUpfrontPaid] = useState<string>('');
  const [senetInstallmentCount, setSenetInstallmentCount] =
    useState<string>('');
  const [senetFirstDueDate, setSenetFirstDueDate] =
    useState<string>('');
  const [senetDayOfMonth, setSenetDayOfMonth] = useState<string>('');

  // Draft: device rows for this new patient.
  // Always start with one row ready to fill; additional rows are added via "Cihaz ekle".
  const [deviceDrafts, setDeviceDrafts] = useState<NewPatientDeviceDraft[]>([
    createEmptyDeviceDraft(),
  ]);

  const resetFormState = () => {
    setFormState({
      fullName: '',
      phone: '',
      sgkFlag: true,
      sgkPrescriptionReceived: false,
      sgkRecordedToSystem: false,
      sgkProfileId: '',
      sgkExpectedReimbursement: '',
      sgkExpectedMonth: '',
      sgkPrescriptionNo: '',
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
    setSenetUpfrontPaid('');
    setSenetInstallmentCount('');
    setSenetFirstDueDate('');
    setSenetDayOfMonth('');
    setDeviceDrafts([createEmptyDeviceDraft()]);
    setLocalError(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const fullName = formState.fullName.trim();
    const tcRaw = formState.nationalId;
    const phoneRaw = formState.phone;
    const paymentMethod = formState.paymentMethod;
    const saleTotalRaw = formState.saleTotal.trim();

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
    if (!paymentMethod) {
      setLocalError('Ödeme şeklini seçmeniz gerekiyor.');
      return;
    }
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

      const installmentPlanDraft: UpsertPatientInstallmentPlanInput | null =
        hasInstallmentDraft
          ? {
              patientId: '', // createPatient sonrası zincirde doldurulacak.
              saleTotal: saleTotalRaw,
              upfrontPaid: senetUpfrontPaid.trim(),
              installmentCount: senetInstallmentCount.trim(),
              firstDueDate: senetFirstDueDate.trim(),
              dayOfMonth: senetDayOfMonth.trim(),
            }
          : null;

      onSubmit({
        fullName,
        phone: normalizedPhone,
        sgkFlag: formState.sgkFlag,
        sgkPrescriptionReceived: formState.sgkFlag
          ? formState.sgkPrescriptionReceived
          : false,
        sgkRecordedToSystem: formState.sgkFlag
          ? formState.sgkRecordedToSystem
          : false,
        sgkProfileId: formState.sgkFlag ? formState.sgkProfileId : '',
        sgkExpectedReimbursement: formState.sgkFlag
          ? formState.sgkExpectedReimbursement
          : '',
        sgkExpectedMonth: formState.sgkFlag
          ? formState.sgkExpectedMonth
          : '',
        sgkPrescriptionNo: formState.sgkFlag
          ? (formState.sgkPrescriptionNo ?? '').trim()
          : '',
        paymentMethod,
        saleTotal: saleTotalRaw,
        cardFeeRate: formState.cardFeeRate,
        referenceId: formState.referenceId,
        referenceName: formState.referenceName,
        nationalId: normalizedNationalId,
        kinPhone: formState.kinPhone.trim(),
        address: formState.address.trim(),
        // v2: Çoklu ödeme tasarımı payment bloğunda kurgulanacak.
        // Şimdilik yeni hasta formu için dağılım taslağı boş bırakılıyor.
        saleBreakdownDraft: [],
        installmentPlanDraft,
        deviceDrafts,
      });

      // Optional: caller may choose to call resetFormState() after a successful create.
      // resetFormState();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Form doğrulaması sırasında hata oluştu.';
      setLocalError(message);
    }
  };

  const handleChangePaymentMethod = (
    value: PatientPaymentMethodFormValue,
  ) => {
    setFormState((s) => ({
      ...s,
      paymentMethod: value,
      // Komisyon oranı sadece kartta kullanılıyor.
      cardFeeRate: value === 'Kredi_Kartı' ? s.cardFeeRate : '',
    }));
  };

  const handleAddDeviceRow = () => {
    setDeviceDrafts((rows) => {
      if (rows.length === 0) {
        return [createEmptyDeviceDraft()];
      }

      // İkinci cihaz için varsayılan: ilk satırdaki bilgileri kopyala,
      // seri numarası/inventoryId hariç her şey doldurulmuş gelsin.
      const first = rows[0];
      return [
        ...rows,
        {
          inventoryItemId: null,
          side: first.side,
          brand: first.brand,
          model: first.model,
          listPrice: first.listPrice,
          salePrice: first.salePrice,
          note: first.note,
        },
      ];
    });
  };

  const handleChangeDeviceRow = (
    index: number,
    patch: Partial<NewPatientDeviceDraft>,
  ) => {
    setDeviceDrafts((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const handleRemoveDeviceRow = (index: number) => {
    setDeviceDrafts((rows) => {
      const next = rows.filter((_, i) => i !== index);
      if (next.length === 0) {
        // Her zaman en az bir satır açık kalsın.
        return [createEmptyDeviceDraft()];
      }
      return next;
    });
  };

  const combinedError = localError || externalErrorMessage || undefined;
  const isSenet = formState.paymentMethod === 'Senet';

  return {
    formState,
    setFormState,
    deviceDrafts,
    handleAddDeviceRow,
    handleChangeDeviceRow,
    handleRemoveDeviceRow,
    handleChangePaymentMethod,
    senetUpfrontPaid,
    setSenetUpfrontPaid,
    senetInstallmentCount,
    setSenetInstallmentCount,
    senetFirstDueDate,
    setSenetFirstDueDate,
    senetDayOfMonth,
    setSenetDayOfMonth,
    isSenet,
    combinedError,
    handleSubmit,
    resetFormState,
  };
}

// Normalize phone for storage / future WhatsApp links.
// - Accepts:
//   * +<country><number> (e.g. +491234...)
//   * 00<country><number> (converted to +...)
//   * TR local numbers (05XXXXXXXXX or 5XXXXXXXXX etc.)
// - Returns E.164-like string starting with '+'.
function normalizePhone(input: string): string {
  const raw = input.trim();
  if (!raw) {
    throw new Error('Telefon boş olamaz.');
  }

  // Remove common separators but keep leading '+' or '00'
  let v = raw.replace(/[()\s-]/g, '');

  // Case 1: starts with '+'
  if (v.startsWith('+')) {
    const digits = v.slice(1).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      throw new Error(
        'Telefon numarası geçerli bir uluslararası formatta değil.',
      );
    }
    return `+${digits}`;
  }

  // Case 2: starts with '00' -> convert to '+'
  if (v.startsWith('00')) {
    const digits = v.slice(2).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      throw new Error(
        'Telefon numarası geçerli bir uluslararası formatta değil.',
      );
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

  throw new Error(
    'Telefon numarası 10–11 haneli TR veya geçerli uluslararası formatta olmalıdır.',
  );
}

// Normalize T.C.: keep digits only and require 11 digits.
function normalizeNationalId(input: string): string {
  const digits = input.trim().replace(/\D/g, '');
  if (digits.length !== 11) {
    throw new Error('T.C. Kimlik No 11 haneli olmalıdır.');
  }
  return digits;
}
