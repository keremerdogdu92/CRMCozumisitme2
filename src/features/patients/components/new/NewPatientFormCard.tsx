// src/features/patients/components/new/NewPatientFormCard.tsx
// Inline "Yeni Hasta" form card using InlineCreateCard and modular subsections.
// Layout:
// - Column 1 (desktop): Ad Soyad, T.C. Kimlik No
// - Column 2 (desktop): Telefon, Yakın Telefon
// - Column 3 (desktop): Referans, Adres
//
// v2 rules (business requirements):
// - Required fields: Ad Soyad, T.C. Kimlik No, Telefon, Ödeme Şekli, Toplam Satış Tutarı.
// - Phone is normalized to E.164-like format via useNewPatientForm hook.
// - National ID is digit-only, 11 digits, normalized via useNewPatientForm hook.

import type { NewPatientForm } from '../../types';
import { InlineCreateCard } from '../../../../components/layout/InlineCreateCard';
import { FormSection } from '../../../../components/layout/FormSection';
import { NewPatientReferenceField } from './NewPatientReferenceField';
import { NewPatientSgkSection } from './NewPatientSgkSection';
import { NewPatientPaymentSection } from './NewPatientPaymentSection';
import { PatientSenetPlanFormCard } from '../billing/PatientSenetPlanFormCard';
import { NewPatientDevicesSection } from './NewPatientDevicesSection';
import { Button } from '../../../../components/ui/Button';
import { useNewPatientForm } from '../../hooks/useNewPatientForm';

type NewPatientFormCardProps = {
  open: boolean;
  onToggle: () => void;
  onSubmit: (values: NewPatientForm) => void;
  isSubmitting: boolean;
  errorMessage?: string;
};

export function NewPatientFormCard({
  open,
  onToggle,
  onSubmit,
  isSubmitting,
  errorMessage,
}: NewPatientFormCardProps) {
  const {
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
  } = useNewPatientForm({
    onSubmit,
    externalErrorMessage: errorMessage,
  });

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
          <div className="grid gap-3 md:grid-cols-12">
            {/* Column 1: Ad Soyad + T.C. Kimlik No */}
            <div className="space-y-2 md:col-span-4">
              {/* Ad Soyad */}
              <div>
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
              <div>
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
            </div>

            {/* Column 2: Telefon + Yakın Telefon */}
            <div className="space-y-2 md:col-span-4">
              {/* Telefon */}
              <div>
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

              {/* Yakın Telefonu */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Yakın Telefonu
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
            </div>

            {/* Column 3: Referans + Adres */}
            <div className="space-y-2 md:col-span-4">
              {/* Referans */}
              <div className="relative">
                <NewPatientReferenceField
                  referenceId={formState.referenceId}
                  referenceName={formState.referenceName}
                  onChangeReference={({
                    id,
                    name,
                  }: {
                    id: string | null;
                    name: string;
                  }) =>
                    setFormState((s) => ({
                      ...s,
                      referenceId: id,
                      referenceName: name,
                    }))
                  }
                />
              </div>

              {/* Adres */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Adres
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
            </div>
          </div>
        </FormSection>

        {/* SGK + Ödeme bloğu */}
        <FormSection title="SGK ve Ödeme">
          <div className="grid gap-3 md:grid-cols-12 md:items-start">
            {/* SGK üçlüsü + profil (sol sütun) */}
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
                sgkPrescriptionNo={formState.sgkPrescriptionNo ?? ''}
                onChangeSgkFlag={(value: boolean) =>
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
                    sgkExpectedMonth: value ? s.sgkExpectedMonth ?? '' : '',
                    sgkPrescriptionNo: value
                      ? s.sgkPrescriptionNo ?? ''
                      : '',
                  }))
                }
                onChangeSgkPrescriptionReceived={(value: boolean) =>
                  setFormState((s) => ({
                    ...s,
                    sgkPrescriptionReceived: value,
                  }))
                }
                onChangeSgkRecordedToSystem={(value: boolean) =>
                  setFormState((s) => ({
                    ...s,
                    sgkRecordedToSystem: value,
                  }))
                }
                onChangeSgkProfileId={(value: string) =>
                  setFormState((s) => ({
                    ...s,
                    sgkProfileId: value,
                  }))
                }
                onChangeSgkExpectedReimbursement={(value: string) =>
                  setFormState((s) => ({
                    ...s,
                    sgkExpectedReimbursement: value,
                  }))
                }
                onChangeSgkExpectedMonth={(value: string) =>
                  setFormState((s) => ({
                    ...s,
                    sgkExpectedMonth: value,
                  }))
                }
                onChangeSgkPrescriptionNo={(value: string) =>
                  setFormState((s) => ({
                    ...s,
                    sgkPrescriptionNo: value,
                  }))
                }
              />
            </div>

            {/* Ödeme bloğu + (gerekirse) senet planı (sağ sütun) */}
            <div className="space-y-3 md:col-span-8">
              <NewPatientPaymentSection
                paymentMethod={formState.paymentMethod}
                saleTotal={formState.saleTotal}
                cardFeeRate={formState.cardFeeRate}
                onChangePaymentMethod={handleChangePaymentMethod}
                onChangeSaleTotal={(value: string) =>
                  setFormState((s) => ({
                    ...s,
                    saleTotal: value,
                  }))
                }
                onChangeCardFeeRate={(value: string) =>
                  setFormState((s) => ({
                    ...s,
                    cardFeeRate: value,
                  }))
                }
              />

              {/* Senet seçildiyse: ödeme bloğunun devamı gibi senet plan formu */}
              {isSenet && (
                <PatientSenetPlanFormCard
                  plan={null}
                  saleTotal={formState.saleTotal}
                  upfrontPaid={senetUpfrontPaid}
                  installmentCount={senetInstallmentCount}
                  firstDueDate={senetFirstDueDate}
                  dayOfMonth={senetDayOfMonth}
                  setSaleTotal={(v: string) =>
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
                  upsertPlan={async () => {
                    return;
                  }}
                />
              )}
            </div>
          </div>
        </FormSection>

        {/* Cihazlar bloğu */}
        <FormSection
          title="Cihazlar"
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
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </form>
    </InlineCreateCard>
  );
}
