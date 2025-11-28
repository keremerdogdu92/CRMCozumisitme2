// src/features/patients/NewPatientFormCard.tsx
// Inline "Yeni Hasta" form card using InlineCreateCard and modular subsections.
// Layout:
//  - Row 1 (desktop): Ad Soyad, T.C. Kimlik No, Telefon
//  - Row 2 (desktop): Yakın Telefonu, Adres, Referans
//  - Row 3 (desktop): SGK üçlüsü + Ödeme Şekli

import { useState, FormEvent } from 'react';
import type {
  NewPatientForm,
  PatientPaymentMethodFormValue,
} from './types';
import { InlineCreateCard } from '../../components/layout/InlineCreateCard';
import { NewPatientReferenceField } from './NewPatientReferenceField';
import { NewPatientSgkSection } from './NewPatientSgkSection';
import { NewPatientPaymentSection } from './NewPatientPaymentSection';

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
  const [formState, setFormState] = useState<NewPatientForm>({
    fullName: '',
    phone: '',
    sgkFlag: true,
    sgkPrescriptionReceived: false,
    sgkRecordedToSystem: false,
    paymentMethod: '',
    cardSaleTotal: '',
    cardFeeRate: '',
    referenceId: null,
    referenceName: '',
    nationalId: '',
    kinPhone: '',
    address: '',
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formState.fullName.trim()) return;

    onSubmit({
      fullName: formState.fullName,
      phone: formState.phone,
      sgkFlag: formState.sgkFlag,
      sgkPrescriptionReceived: formState.sgkFlag
        ? formState.sgkPrescriptionReceived
        : false,
      sgkRecordedToSystem: formState.sgkFlag
        ? formState.sgkRecordedToSystem
        : false,
      paymentMethod: formState.paymentMethod,
      cardSaleTotal: formState.cardSaleTotal,
      cardFeeRate: formState.cardFeeRate,
      referenceId: formState.referenceId,
      referenceName: formState.referenceName,
      nationalId: formState.nationalId,
      kinPhone: formState.kinPhone,
      address: formState.address,
    });

    setFormState({
      fullName: '',
      phone: '',
      sgkFlag: true,
      sgkPrescriptionReceived: false,
      sgkRecordedToSystem: false,
      paymentMethod: '',
      cardSaleTotal: '',
      cardFeeRate: '',
      referenceId: null,
      referenceName: '',
      nationalId: '',
      kinPhone: '',
      address: '',
    });
  };

  const handleChangePaymentMethod = (
    value: PatientPaymentMethodFormValue,
  ) => {
    setFormState((s) => ({
      ...s,
      paymentMethod: value,
      // For non-card methods, wipe card-specific fields
      cardSaleTotal: value === 'Kredi_Kartı' ? s.cardSaleTotal : '',
      cardFeeRate: value === 'Kredi_Kartı' ? s.cardFeeRate : '',
    }));
  };

  return (
    <InlineCreateCard
      title="Yeni Hasta Ekle"
      description="Yeni kayıt için kısa form. Özlük, SGK ve ödeme tipi bilgileri ana listede uyarıları tetikler."
      open={open}
      onToggle={onToggle}
      errorMessage={errorMessage}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Özlük bilgileri bloğu */}
        <section className="space-y-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-3">
          <h4 className="text-xs font-semibold uppercase text-slate-500">
            Özlük Bilgileri
          </h4>

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
                  setFormState((s) => ({ ...s, fullName: e.target.value }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Örn. Ahmet Yılmaz"
              />
            </div>

            {/* T.C. Kimlik No */}
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                T.C. Kimlik No (opsiyonel)
              </label>
              <input
                type="text"
                value={formState.nationalId}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, nationalId: e.target.value }))
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
                value={formState.phone}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, phone: e.target.value }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="05XXXXXXXXX"
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
                  setFormState((s) => ({ ...s, kinPhone: e.target.value }))
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
                  setFormState((s) => ({ ...s, address: e.target.value }))
                }
                rows={2}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Kısa adres bilgisi"
              />
            </div>

            {/* Referans (opsiyonel) */}
            <div className="md:col-span-4 relative">
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

          <p className="text-[11px] text-slate-500">
            Bu bilgiler hasta detayında &quot;Özlük Bilgileri&quot; bölümünde
            görüntülenir. Doldurmak zorunlu değildir; gerektiğinde daha sonra da
            güncellenebilir.
          </p>
        </section>

        {/* SGK + Ödeme bloğu */}
        <section className="space-y-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-3">
          <h4 className="text-xs font-semibold uppercase text-slate-500">
            SGK ve Ödeme
          </h4>
          <div className="grid gap-3 md:grid-cols-12 md:items-start">
            {/* SGK üçlüsü */}
            <div className="md:col-span-4">
              <NewPatientSgkSection
                sgkFlag={formState.sgkFlag}
                sgkPrescriptionReceived={formState.sgkPrescriptionReceived}
                sgkRecordedToSystem={formState.sgkRecordedToSystem}
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
              />
            </div>

            {/* Ödeme şekli + kart detayları */}
            <div className="md:col-span-8">
              <NewPatientPaymentSection
                paymentMethod={formState.paymentMethod}
                cardSaleTotal={formState.cardSaleTotal}
                cardFeeRate={formState.cardFeeRate}
                onChangePaymentMethod={handleChangePaymentMethod}
                onChangeCardSaleTotal={(value) =>
                  setFormState((s) => ({ ...s, cardSaleTotal: value }))
                }
                onChangeCardFeeRate={(value) =>
                  setFormState((s) => ({ ...s, cardFeeRate: value }))
                }
              />
            </div>
          </div>
        </section>

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
