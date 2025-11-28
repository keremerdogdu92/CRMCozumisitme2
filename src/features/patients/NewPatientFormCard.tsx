// src/features/patients/NewPatientFormCard.tsx
// Inline "Yeni Hasta" form card using InlineCreateCard and modular subsections.

import { useState, FormEvent } from 'react';
import type {
  NewPatientForm,
  PatientPaymentMethodFormValue,
} from './types';
import { InlineCreateCard } from '../../components/layout/InlineCreateCard';
import { NewPatientReferenceField } from './NewPatientReferenceField';
import { NewPatientSgkSection } from './NewPatientSgkSection';
import { NewPatientPaymentSection } from './NewPatientPaymentSection';
import { NewPatientIdentitySection } from './NewPatientIdentitySection';

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
      <form
        className="grid gap-3 md:grid-cols-4 md:items-start"
        onSubmit={handleSubmit}
      >
        {/* Full name */}
        <div className="md:col-span-2">
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

        {/* Phone */}
        <div>
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

        {/* Reference selector (search + dropdown) */}
        <div className="md:col-span-1 relative">
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

        {/* SGK triple checkbox group */}
        <div className="md:col-span-1">
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

        {/* Identity / address block */}
        <div className="md:col-span-4">
          <NewPatientIdentitySection
            nationalId={formState.nationalId}
            kinPhone={formState.kinPhone}
            address={formState.address}
            onChangeNationalId={(value) =>
              setFormState((s) => ({ ...s, nationalId: value }))
            }
            onChangeKinPhone={(value) =>
              setFormState((s) => ({ ...s, kinPhone: value }))
            }
            onChangeAddress={(value) =>
              setFormState((s) => ({ ...s, address: value }))
            }
          />
        </div>

        {/* Payment method + card details */}
        <div className="md:col-span-4">
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

        {/* Submit button */}
        <div className="md:col-span-4 flex justify-end">
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
