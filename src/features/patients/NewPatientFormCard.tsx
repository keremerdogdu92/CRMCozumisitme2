// src/features/patients/NewPatientFormCard.tsx
// Inline "Yeni Hasta" form card using InlineCreateCard and modular subsections.
// Layout:
// - Row 1 (desktop): Ad Soyad, T.C. Kimlik No, Telefon
// - Row 2 (desktop): Yakın Telefonu, Adres, Referans
// - Row 3 (desktop): SGK üçlüsü + Ödeme Şekli
//
// v2 kuralları:
// - Zorunlu alanlar: Ad Soyad, T.C. Kimlik No, Telefon, Ödeme Şekli, Toplam Satış Tutarı.
// - Telefon E.164 uyumlu normalize edilir:
//   * '+' veya '00' ile başlayan yabancı numaralar desteklenir.
//   * Diğer girişler TR olarak varsayılır ve +90 ile normalize edilir.
// - T.C. Kimlik No sadece rakamlardan oluşur ve 11 hanelidir.

import { useState, useMemo, FormEvent } from 'react';
import type {
  NewPatientForm,
  PatientPaymentMethodFormValue,
  UpsertPatientSaleBreakdownItem,
  UpsertPatientInstallmentPlanInput,
  NewPatientDeviceDraft,
} from './types';
import { InlineCreateCard } from '../../components/layout/InlineCreateCard';
import { NewPatientReferenceField } from './NewPatientReferenceField';
import { NewPatientSgkSection } from './NewPatientSgkSection';
import { NewPatientPaymentSection } from './NewPatientPaymentSection';
import { FormSection } from '../../components/layout/FormSection';
import { PatientSaleBreakdownCard } from './PatientSaleBreakdownCard';
import { PatientSenetPlanFormCard } from './PatientSenetPlanFormCard';
import { NewPatientDevicesSection } from './NewPatientDevicesSection';

type NewPatientFormCardProps = {
  open: boolean;
  onToggle: () => void;
  onSubmit: (values: NewPatientForm) => void;
  isSubmitting: boolean;
  errorMessage?: string;
};

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
    // Example: 5XXXXXXXXX or 05XXXXXXXX
    if (digits.startsWith('0')) {
      return `+90${digits.slice(1)}`;
    }
    return `+90${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    // Example: 05XXXXXXXXX
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

export function NewPatientFormCard({
  open,
  onToggle,
  onSubmit,
  isSubmitting,
  errorMessage,
}: NewPatientFormCardProps) {
  const [formState, setFormState] = useState<NewPatientForm>({
    fullName: '',
    phone: '',
    sgkFlag: true,
    sgkPrescriptionReceived: false,
    sgkRecordedToSystem: false,
    sgkProfileId: '',
    sgkExpectedReimbursement: '',
    sgkExpectedMonth: '',
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

  // Draft: breakdown lines for this new patient.
  const [breakdownItems, setBreakdownItems] =
    useState<UpsertPatientSaleBreakdownItem[]>([]);

  // Draft: senet plan fields for this new patient.
  const [senetUpfrontPaid, setSenetUpfrontPaid] = useState<string>('');
  const [senetInstallmentCount, setSenetInstallmentCount] =
    useState<string>('');
  const [senetFirstDueDate, setSenetFirstDueDate] =
    useState<string>('');
  const [senetDayOfMonth, setSenetDayOfMonth] = useState<string>('');

  // Draft: device rows for this new patient.
  const [deviceDrafts, setDeviceDrafts] = useState<NewPatientDeviceDraft[]>(
    [],
  );

  const breakdownTotal = useMemo(() => {
    return breakdownItems.reduce((sum, item) => {
      const raw = (item.amount ?? '').trim();
      if (!raw) return sum;
      const normalized = raw.replace(/\./g, '').replace(',', '.');
      const num = Number(normalized);
      if (!Number.isFinite(num) || num <= 0) return sum;
      return sum + num;
    }, 0);
  }, [breakdownItems]);

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
    setBreakdownItems([]);
    setSenetUpfrontPaid('');
    setSenetInstallmentCount('');
    setSenetFirstDueDate('');
    setSenetDayOfMonth('');
    setDeviceDrafts([]);
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
        paymentMethod,
        saleTotal: saleTotalRaw,
        cardFeeRate: formState.cardFeeRate,
        referenceId: formState.referenceId,
        referenceName: formState.referenceName,
        nationalId: normalizedNationalId,
        kinPhone: formState.kinPhone.trim(),
        address: formState.address.trim(),
        // Financial drafts: createPatient doğrudan kullanmaz; create sonrası
        // savePatientSaleBreakdown + upsertPatientInstallmentPlan zincirinde
        // kullanılmak üzere üst levele taşınıyor.
        saleBreakdownDraft: breakdownItems,
        installmentPlanDraft,
        // Device drafts: create sonrası hasta cihazlarına bağlanmak için
        // üst levele taşınıyor.
        deviceDrafts,
      });

      // Başarılı kayıttan sonra üst komponent isterse resetFormState çağırabilir.
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
    setDeviceDrafts((rows) => [
      ...rows,
      {
        inventoryItemId: null,
        side: '',
        brand: '',
        model: '',
        listPrice: '',
        salePrice: '',
        note: '',
      },
    ]);
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
    setDeviceDrafts((rows) => rows.filter((_, i) => i !== index));
  };

  const combinedError = localError || errorMessage || undefined;

  return (
    <InlineCreateCard
      title="Yeni Hasta Ekle"
      description="Yeni kayıt için kısa form. Özlük, SGK ve ödeme bilgileri ana listede uyarıları tetikler."
      open={open}
      onToggle={onToggle}
      errorMessage={combinedError}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Özlük bilgileri bloğu */}
        <FormSection
          title="Özlük Bilgileri"
          description='Bu bilgiler hasta detayında "Özlük Bilgileri" bölümünde görüntülenir. Doldurmak zorunlu değildir; gerektiğinde daha sonra da güncellenebilir.'
        >
          {/* Row 1: Ad Soyad / T.C. / Telefon */}
          <div className="grid gap-3 md:grid-cols-12">
            {/* Ad Soyad */}
            <div className="md:col-span-5">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Ad Soyad
              </label>
              <input
                type="text"
                required
                value={formState.fullName}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    fullName: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Örn. Ahmet Yılmaz"
              />
            </div>

            {/* T.C. Kimlik No */}
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                T.C. Kimlik No
              </label>
              <input
                type="text"
                required
                value={formState.nationalId}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    nationalId: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="11 haneli T.C. no"
              />
            </div>

            {/* Telefon */}
            <div className="md:col-span-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Telefon
              </label>
              <input
                type="tel"
                required
                value={formState.phone}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    phone: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="05XXXXXXXXX veya +49..."
              />
            </div>
          </div>

          {/* Row 2: Yakın Telefonu / Adres / Referans */}
          <div className="grid gap-3 md:grid-cols-12">
            {/* Yakın Telefonu */}
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Yakın Telefonu (opsiyonel)
              </label>
              <input
                type="tel"
                value={formState.kinPhone}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    kinPhone: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Acil durumda aranacak kişi"
              />
            </div>

            {/* Adres */}
            <div className="md:col-span-5">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Adres (opsiyonel)
              </label>
              <textarea
                value={formState.address}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    address: e.target.value,
                  }))
                }
                rows={2}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Kısa adres bilgisi"
              />
            </div>

            {/* Referans (opsiyonel) */}
            <div className="relative md:col-span-4">
              <NewPatientReferenceField
                referenceId={formState.referenceId}
                referenceName={formState.referenceName}
                onChangeReference={({ id, name }) =>
                  setFormState((s) => ({
                    ...s,
                    referenceId: id,
                    referenceName: name,
                  }))
                }
              />
            </div>
          </div>
        </FormSection>

        {/* SGK + Ödeme bloğu */}
        <FormSection title="SGK ve Ödeme">
          <div className="grid gap-3 md:grid-cols-12 md:items-start">
            {/* SGK üçlüsü + profil */}
            <div className="md:col-span-4">
              <NewPatientSgkSection
                sgkFlag={formState.sgkFlag}
                sgkPrescriptionReceived={formState.sgkPrescriptionReceived}
                sgkRecordedToSystem={formState.sgkRecordedToSystem}
                sgkProfileId={formState.sgkProfileId ?? ''}
                sgkExpectedReimbursement={
                  formState.sgkExpectedReimbursement ?? ''
                }
                sgkExpectedMonth={formState.sgkExpectedMonth ?? ''}
                onChangeSgkFlag={(value) =>
                  setFormState((s) => ({
                    ...s,
                    sgkFlag: value,
                    sgkPrescriptionReceived: value
                      ? s.sgkPrescriptionReceived
                      : false,
                    sgkRecordedToSystem: value
                      ? s.sgkRecordedToSystem
                      : false,
                    sgkProfileId: value ? s.sgkProfileId ?? '' : '',
                    sgkExpectedReimbursement: value
                      ? s.sgkExpectedReimbursement ?? ''
                      : '',
                    sgkExpectedMonth: value
                      ? s.sgkExpectedMonth ?? ''
                      : '',
                  }))
                }
                onChangeSgkPrescriptionReceived={(value) =>
                  setFormState((s) => ({
                    ...s,
                    sgkPrescriptionReceived: value,
                  }))
                }
                onChangeSgkRecordedToSystem={(value) =>
                  setFormState((s) => ({
                    ...s,
                    sgkRecordedToSystem: value,
                  }))
                }
                onChangeSgkProfileId={(value) =>
                  setFormState((s) => ({
                    ...s,
                    sgkProfileId: value,
                  }))
                }
                onChangeSgkExpectedReimbursement={(value) =>
                  setFormState((s) => ({
                    ...s,
                    sgkExpectedReimbursement: value,
                  }))
                }
                onChangeSgkExpectedMonth={(value) =>
                  setFormState((s) => ({
                    ...s,
                    sgkExpectedMonth: value,
                  }))
                }
              />
            </div>

            {/* Ödeme şekli + kart detayları */}
            <div className="md:col-span-8">
              <NewPatientPaymentSection
                paymentMethod={formState.paymentMethod}
                saleTotal={formState.saleTotal}
                cardFeeRate={formState.cardFeeRate}
                onChangePaymentMethod={handleChangePaymentMethod}
                onChangeSaleTotal={(value) =>
                  setFormState((s) => ({
                    ...s,
                    saleTotal: value,
                  }))
                }
                onChangeCardFeeRate={(value) =>
                  setFormState((s) => ({
                    ...s,
                    cardFeeRate: value,
                  }))
                }
              />
            </div>
          </div>

          {/* Gelişmiş ödeme taslakları: breakdown + senet planı */}
          <div className="mt-3 space-y-3">
            <p className="text-[11px] text-slate-600">
              Aşağıdaki alanlar bu yeni hasta için ödeme dağılımı ve senet
              planı taslağını tutar. Hasta kaydından sonra bu bilgiler
              detay ekranındaki Ödemeler sekmesinde de düzenlenebilir.
            </p>

            <PatientSaleBreakdownCard
              items={breakdownItems}
              onAddRow={() =>
                setBreakdownItems((rows) => [
                  ...rows,
                  {
                    id: undefined,
                    method: 'Kredi_Kartı',
                    amount: '',
                    note: '',
                  },
                ])
              }
              onChangeRow={(index, patch) =>
                setBreakdownItems((rows) =>
                  rows.map((row, i) =>
                    i === index ? { ...row, ...patch } : row,
                  ),
                )
              }
              onRemoveRow={(index) =>
                setBreakdownItems((rows) =>
                  rows.filter((_, i) => i !== index),
                )
              }
              onSave={() => {
                // New patient flow: gerçek kayıt, createPatient sonrası
                // savePatientSaleBreakdown ile yapılacak.
                // Bu handler, taslağın zaten form state'inde tutulduğu
                // için ekstra işlem yapmıyor.
                return;
              }}
              totalAmount={breakdownTotal}
              isLoading={false}
              isSaving={false}
              errorMessage={null}
            />

            <PatientSenetPlanFormCard
              plan={null}
              saleTotal={formState.saleTotal}
              upfrontPaid={senetUpfrontPaid}
              installmentCount={senetInstallmentCount}
              firstDueDate={senetFirstDueDate}
              dayOfMonth={senetDayOfMonth}
              setSaleTotal={(v) =>
                setFormState((s) => ({
                  ...s,
                  saleTotal: v,
                }))
              }
              setUpfrontPaid={setSenetUpfrontPaid}
              setInstallmentCount={setSenetInstallmentCount}
              setFirstDueDate={setSenetFirstDueDate}
              setDayOfMonth={setSenetDayOfMonth}
              isPlanSaveError={false}
              planSaveError={null}
              isPlanError={false}
              planError={null}
              isPlanSaving={false}
              patientId=""
              upsertPlan={async (_input: UpsertPatientInstallmentPlanInput) => {
                // New patient flow: gerçek upsert, createPatient sonrası
                // upsertPatientInstallmentPlan ile yapılacak.
                return;
              }}
            />
          </div>
        </FormSection>

        {/* Cihaz taslakları bloğu */}
        <FormSection
          title="Cihazlar (opsiyonel)"
          description="Stoktaki cihazları bu hastaya bağlamak için kulak yönü ve cihaz seçimlerini burada yapabilirsiniz. Hasta kaydından sonra inventory'de ilgili satırlar 'satıldı' olarak işaretlenecek."
        >
          <NewPatientDevicesSection
            items={deviceDrafts}
            onAddRow={handleAddDeviceRow}
            onChangeRow={handleChangeDeviceRow}
            onRemoveRow={handleRemoveDeviceRow}
          />
        </FormSection>

        {/* Submit button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </InlineCreateCard>
  );
}
