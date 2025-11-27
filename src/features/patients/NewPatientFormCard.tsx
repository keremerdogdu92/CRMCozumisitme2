// src/features/patients/NewPatientFormCard.tsx
// Inline "Yeni Hasta" form card using InlineCreateCard and domain-specific fields.

import { useState, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  NewPatientForm,
  PatientPaymentMethodFormValue,
} from './types';
import { InlineCreateCard } from '../../components/layout/InlineCreateCard';
import { searchReferencesByName } from '../references/api';

type NewPatientFormCardProps = {
  open: boolean;
  onToggle: () => void;
  onSubmit: (values: NewPatientForm) => void;
  isSubmitting: boolean;
  errorMessage?: string;
};

const PAYMENT_METHOD_OPTIONS: {
  value: PatientPaymentMethodFormValue;
  label: string;
}[] = [
  { value: '', label: 'Seçilmedi' },
  { value: 'Tim', label: 'Tim' },
  { value: 'Sivantos', label: 'Sivantos' },
  { value: 'Kredi_Kartı', label: 'Kredi Kartı' },
  { value: 'Nakit', label: 'Nakit' },
  { value: 'Senet', label: 'Senet' },
];

type ReferenceSearchResult = {
  id: string;
  full_name: string;
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
  });

  const [referenceSearch, setReferenceSearch] = useState('');
  const [isReferenceDropdownOpen, setIsReferenceDropdownOpen] =
    useState(false);

  const isCard = formState.paymentMethod === 'Kredi_Kartı';

  const {
    data: referenceOptions = [],
    isLoading: isReferenceLoading,
    isError: isReferenceError,
  } = useQuery<ReferenceSearchResult[]>({
    queryKey: ['reference-search-for-patient', referenceSearch],
    queryFn: () => searchReferencesByName(referenceSearch),
    enabled:
      isReferenceDropdownOpen && referenceSearch.trim().length >= 2,
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
    });
    setReferenceSearch('');
    setIsReferenceDropdownOpen(false);
  };

  const handleReferenceInputChange = (value: string) => {
    setReferenceSearch(value);
    setIsReferenceDropdownOpen(true);
    setFormState((s) => ({
      ...s,
      referenceId: null,
      referenceName: value,
    }));
  };

  const handleSelectReference = (ref: ReferenceSearchResult) => {
    setFormState((s) => ({
      ...s,
      referenceId: ref.id,
      referenceName: ref.full_name,
    }));
    setReferenceSearch(ref.full_name);
    setIsReferenceDropdownOpen(false); // ÖNEMLİ: seçim sonrası dropdown kapanır
  };

  const handleClearReference = () => {
    setFormState((s) => ({
      ...s,
      referenceId: null,
      referenceName: '',
    }));
    setReferenceSearch('');
    setIsReferenceDropdownOpen(false);
  };

  return (
    <InlineCreateCard
      title="Yeni Hasta Ekle"
      description="Yeni kayıt için kısa form. SGK ve ödeme tipi bilgileri ana listede uyarıları tetikler."
      open={open}
      onToggle={onToggle}
      errorMessage={errorMessage}
    >
      <form
        className="grid gap-3 md:grid-cols-4 md:items-start"
        onSubmit={handleSubmit}
      >
        {/* Ad Soyad */}
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

        {/* Telefon */}
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

        {/* Referans (opsiyonel) */}
        <div className="md:col-span-1 relative">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Referans (opsiyonel)
          </label>
          <div className="relative">
            <input
              type="text"
              value={referenceSearch}
              onChange={(e) =>
                handleReferenceInputChange(e.target.value)
              }
              onFocus={() => {
                if (referenceSearch.trim().length >= 2) {
                  setIsReferenceDropdownOpen(true);
                }
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="En az 2 harf yazın..."
            />
            {formState.referenceId && (
              <button
                type="button"
                onClick={handleClearReference}
                className="absolute inset-y-0 right-2 my-auto text-xs text-slate-400 hover:text-slate-600"
              >
                Temizle
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            En az 2 harf yazınca kayıtlı referanslar listelenir; biri
            seçerseniz hasta o referansa bağlanmış olur (şimdilik
            yalnızca form içinde tutuluyor).
          </p>

          {isReferenceDropdownOpen && (
            <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {isReferenceLoading && (
                <div className="px-3 py-2 text-[11px] text-slate-500">
                  Referanslar yükleniyor...
                </div>
              )}
              {isReferenceError && (
                <div className="px-3 py-2 text-[11px] text-red-600">
                  Referanslar alınırken hata oluştu.
                </div>
              )}
              {!isReferenceLoading &&
                !isReferenceError &&
                referenceSearch.trim().length >= 2 &&
                referenceOptions.length === 0 && (
                  <div className="px-3 py-2 text-[11px] text-slate-500">
                    Eşleşen referans bulunamadı.
                  </div>
                )}
              {!isReferenceLoading &&
                !isReferenceError &&
                referenceOptions.length > 0 && (
                  <ul className="text-xs text-slate-800">
                    {referenceOptions.map((ref) => (
                      <li key={ref.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectReference(ref)}
                          className="flex w-full items-center px-3 py-1.5 text-left hover:bg-slate-100"
                        >
                          {ref.full_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          )}
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
                  sgkPrescriptionReceived: checked
                    ? s.sgkPrescriptionReceived
                    : false,
                  sgkRecordedToSystem: checked
                    ? s.sgkRecordedToSystem
                    : false,
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

        {/* Ödeme tipi + kart detayı */}
        <div className="md:col-span-4 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Ödeme Şekli
          </label>
          <div className="grid gap-2 md:grid-cols-4 md:items-end">
            <div className="md:col-span-1">
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={formState.paymentMethod}
                onChange={(e) => {
                  const value =
                    e.target.value as PatientPaymentMethodFormValue;
                  setFormState((s) => ({
                    ...s,
                    paymentMethod: value,
                    cardSaleTotal:
                      value === 'Kredi_Kartı' ? s.cardSaleTotal : '',
                    cardFeeRate:
                      value === 'Kredi_Kartı' ? s.cardFeeRate : '',
                  }));
                }}
              >
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Senet seçersen taksit planını hasta detayındaki Ödemeler
                sekmesinden tanımlayacağız.
              </p>
            </div>

            {isCard && (
              <>
                <div className="md:col-span-1">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Kart Satış Tutarı
                  </label>
                  <input
                    type="text"
                    value={formState.cardSaleTotal}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        cardSaleTotal: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Örn. 80.000"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Komisyon (%)
                  </label>
                  <input
                    type="text"
                    value={formState.cardFeeRate}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        cardFeeRate: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Örn. 3.5"
                  />
                </div>
                <div className="md:col-span-1">
                  <p className="text-[11px] text-slate-500">
                    Kartla yapılan satışlarda bu bilgilerden kart komisyonu
                    hesaplanır. Nakit / Tim / Sivantos / Senet
                    seçeneklerinde bu alanlar kullanılmaz.
                  </p>
                </div>
              </>
            )}
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
