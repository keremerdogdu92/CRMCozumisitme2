// src/features/patients/NewPatientFormCard.tsx
// Inline "Yeni Hasta" form card using InlineCreateCard and domain-specific fields.

import { useState, FormEvent } from 'react';
import type { NewPatientForm } from './types';
import { InlineCreateCard } from '../../components/layout/InlineCreateCard';

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
    });

    // Form başarıyla gönderildiyse, reset işlemi üst seviye tarafından da yapılabilir;
    // burada sadece optimistic reset bırakıyoruz.
    setFormState({
      fullName: '',
      phone: '',
      sgkFlag: true,
      sgkPrescriptionReceived: false,
      sgkRecordedToSystem: false,
    });
  };

  return (
    <InlineCreateCard
      title="Yeni Hasta Ekle"
      description="Yeni kayıt için kısa form. SGK alanları ana listede uyarıları tetikler."
      open={open}
      onToggle={onToggle}
      errorMessage={errorMessage}
    >
      <form
        className="grid gap-3 md:grid-cols-4 md:items-start"
        onSubmit={handleSubmit}
      >
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

        {/* SGK üçlü checkbox grubu */}
        <div className="md:col-span-1 flex flex-col gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <input
              id="sgk-flag"
              type="checkbox"
              checked={formState.sgkFlag}
              onChange={(e) => {
                const checked = e.target.checked;
                setFormState((s) => ({
                  ...s,
                  sgkFlag: checked,
                  sgkPrescriptionReceived: checked ? s.sgkPrescriptionReceived : false,
                  sgkRecordedToSystem: checked ? s.sgkRecordedToSystem : false,
                }));
              }}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <label
              htmlFor="sgk-flag"
              className="select-none text-xs font-medium text-slate-700"
            >
              SGK hastası
            </label>
          </div>

          <div className="flex flex-col gap-1 pl-5 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!formState.sgkFlag}
                checked={formState.sgkPrescriptionReceived}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    sgkPrescriptionReceived: e.target.checked,
                  }))
                }
                className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
              />
              <span>Reçete geldi mi?</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!formState.sgkFlag}
                checked={formState.sgkRecordedToSystem}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    sgkRecordedToSystem: e.target.checked,
                  }))
                }
                className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
              />
              <span>Sisteme işlendi mi?</span>
            </label>
          </div>
        </div>

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
