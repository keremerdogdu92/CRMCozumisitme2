// src/features/meetings/MeetingNewFormCard.tsx
// Inline card with form to create a new meeting.
// v2.5 – refactored: subject search + payment section moved to separate components.

import { useState, FormEvent, useEffect } from 'react';
import { useCreateMeetingMutation } from './api';
import type {
  MeetingAccessoryDraft,
  MeetingType,
  NewMeetingForm,
} from './types';
import { useCurrentProfile } from '../auth/useCurrentProfile';
import { MeetingSubjectSearchField } from './MeetingSubjectSearchField';
import { MeetingPaymentSection } from './MeetingPaymentSection';

const MEETING_TYPE_OPTIONS: { value: MeetingType; label: string }[] = [
  { value: 'patient', label: 'Hasta' },
  { value: 'trial', label: 'Deneme hastası' },
  { value: 'reference', label: 'Referans' },
];

// v2 form initial state
const EMPTY_FORM: NewMeetingForm = {
  meetingType: 'patient',
  subjectId: null,
  subjectName: '',

  subject: '',
  note: '',
  at: '',
  next_at: '',
  satisfaction10: '',

  hasPayment: false,
  paymentAmount: '',
  paymentNote: '',
};

const ACCESSORY_TYPE_OPTIONS: {
  value: MeetingAccessoryDraft['type'];
  label: string;
}[] = [
  { value: 'Dom', label: 'Dom' },
  { value: 'Kulak Kalıbı', label: 'Kulak Kalıbı' },
  { value: 'Receiver', label: 'Receiver' },
  { value: 'Filtre', label: 'Filtre' },
  { value: 'Pil', label: 'Pil' },
  { value: 'Diğer', label: 'Diğer' },
];

export function MeetingNewFormCard() {
  const [form, setForm] = useState<NewMeetingForm>(EMPTY_FORM);
  const [accessories, setAccessories] = useState<MeetingAccessoryDraft[]>([]);
  const [showAccessories, setShowAccessories] = useState(false);
  const { mutateAsync, isPending, isError, error } =
    useCreateMeetingMutation();

  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.role === 'admin';

  // Hide "reference" type in UI for non-admin users
  const visibleTypeOptions = isAdmin
    ? MEETING_TYPE_OPTIONS
    : MEETING_TYPE_OPTIONS.filter((opt) => opt.value !== 'reference');

  // If user is not admin but form state has "reference" from previous session, fix it
  useEffect(() => {
    if (!isAdmin && form.meetingType === 'reference') {
      setForm((f) => ({
        ...f,
        meetingType: 'patient',
        hasPayment: false,
        paymentAmount: '',
        paymentNote: '',
      }));
    }
  }, [isAdmin, form.meetingType]);

  useEffect(() => {
    if (form.meetingType !== 'patient') {
      setAccessories([]);
      setShowAccessories(false);
    }
  }, [form.meetingType]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await mutateAsync({ ...form, accessories });
    setForm(EMPTY_FORM);
    setAccessories([]);
    setShowAccessories(false);
  };

  const handleSubjectSelect = (id: string, name: string) => {
    setForm((f) => ({
      ...f,
      subjectId: id,
      subjectName: name,
    }));
  };

  const showPaymentSection =
    form.meetingType === 'patient' && !!form.subjectId;
  const showAccessorySection =
    form.meetingType === 'patient' && !!form.subjectId;

  const handleAddAccessory = () => {
    const localId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `acc-${Date.now()}-${Math.random()}`;

    setAccessories((prev) => [
      ...prev,
      {
        id: localId,
        type: 'Dom',
        customName: '',
        costPrice: '',
        salePrice: '',
      },
    ]);
  };

  const handleAccessoryChange = (
    index: number,
    patch: Partial<MeetingAccessoryDraft>,
  ) => {
    setAccessories((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const handleAccessoryRemove = (index: number) => {
    setAccessories((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">
        Yeni Görüşme
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Görüşme tipini, kişiyi, tarihleri ve notu girerek kayıt oluşturun.
        Senetli hastalar için bu ekrandan ödeme de kaydedebilirsiniz.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Meeting type + person */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Görüşme Tipi
            </label>
            <select
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={form.meetingType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  meetingType: e.target.value as MeetingType,
                  // Reset subject & payment when type changes
                  subjectId: null,
                  subjectName: '',
                  hasPayment: false,
                  paymentAmount: '',
                  paymentNote: '',
                }))
              }
            >
              {visibleTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Referans tipindeki görüşmeler, kural gereği sadece yönetici
              kullanıcılar tarafından görülebilir.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Görüşme Yapılan Kişi
            </label>

            <MeetingSubjectSearchField
              meetingType={form.meetingType}
              selectedName={form.subjectName}
              onSelect={handleSubjectSelect}
            />
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Başlık
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            value={form.subject}
            onChange={(e) =>
              setForm((f) => ({ ...f, subject: e.target.value }))
            }
            placeholder="Örn: Ayar kontrolü, ilk görüşme..."
          />
        </div>

        {/* Dates */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Görüşme Tarihi
            </label>
            <input
              type="date"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={form.at}
              onChange={(e) =>
                setForm((f) => ({ ...f, at: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Sonraki Görüşme Tarihi
            </label>
            <input
              type="date"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={form.next_at}
              onChange={(e) =>
                setForm((f) => ({ ...f, next_at: e.target.value }))
              }
            />
          </div>
        </div>

        {/* Satisfaction */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Memnuniyet (1–10)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={form.satisfaction10}
              onChange={(e) =>
                setForm((f) => ({ ...f, satisfaction10: e.target.value }))
              }
              placeholder="Boş bırakılabilir"
            />
          </div>
        </div>

        {/* Payment (senet) – only for patient meetings with selected person */}
        {showPaymentSection && form.subjectId && (
          <MeetingPaymentSection
            patientId={form.subjectId}
            form={{
              hasPayment: form.hasPayment,
              paymentAmount: form.paymentAmount,
              paymentNote: form.paymentNote,
            }}
            onChange={(patch) =>
              setForm((f) => ({
                ...f,
                ...patch,
              }))
            }
          />
        )}

        {showAccessorySection && (
          <div className="border-t border-dashed border-slate-200 pt-2">
            <button
              type="button"
              className="mt-1 text-[11px] text-slate-500 underline"
              onClick={() => setShowAccessories((v) => !v)}
            >
              Aksesuar ekle (opsiyonel)
            </button>

            {showAccessories && (
              <div className="mt-2 space-y-2 rounded-md border border-slate-200 p-3">
                {accessories.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    Bu görüşme için aksesuar eklenmedi.
                  </p>
                )}

                {accessories.map((acc, index) => {
                  const isOther = acc.type === 'Diğer';
                  return (
                    <div
                      key={acc.id ?? index}
                      className="grid gap-2 rounded-md bg-slate-50 p-2 sm:grid-cols-4"
                    >
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-[11px] text-slate-600">
                          Aksesuar
                        </label>
                        <select
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                          value={acc.type}
                          onChange={(e) =>
                            handleAccessoryChange(index, {
                              type: e.target.value as MeetingAccessoryDraft['type'],
                            })
                          }
                        >
                          {ACCESSORY_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {isOther && (
                          <input
                            type="text"
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            placeholder="Aksesuar adı"
                            value={acc.customName}
                            onChange={(e) =>
                              handleAccessoryChange(index, {
                                customName: e.target.value,
                              })
                            }
                          />
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] text-slate-600">
                          Maliyet (TL)
                        </label>
                        <input
                          type="text"
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                          value={acc.costPrice}
                          onChange={(e) =>
                            handleAccessoryChange(index, {
                              costPrice: e.target.value,
                            })
                          }
                          placeholder="Opsiyonel"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] text-slate-600">
                          Hastadan alınan (TL)
                        </label>
                        <input
                          type="text"
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                          value={acc.salePrice}
                          onChange={(e) =>
                            handleAccessoryChange(index, {
                              salePrice: e.target.value,
                            })
                          }
                          placeholder="Opsiyonel"
                        />
                      </div>

                      <div className="flex items-end justify-end">
                        <button
                          type="button"
                          className="text-[11px] text-red-600 underline"
                          onClick={() => handleAccessoryRemove(index)}
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="text-[11px] text-primary-600 underline"
                  onClick={handleAddAccessory}
                >
                  Aksesuar satırı ekle
                </button>
              </div>
            )}
          </div>
        )}

        {/* Note */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Not
          </label>
          <textarea
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            rows={3}
            value={form.note}
            onChange={(e) =>
              setForm((f) => ({ ...f, note: e.target.value }))
            }
            placeholder="Görüşme içeriği, yapılan işlemler, notlar..."
          />
        </div>

        {isError && (
          <p className="text-xs text-red-600">
            Kayıt sırasında bir hata oluştu:{' '}
            {(error as Error)?.message ?? 'Bilinmeyen hata'}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {isPending ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </form>
    </div>
  );
}
