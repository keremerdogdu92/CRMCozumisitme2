// src/features/meetings/MeetingNewFormCard.tsx
// Inline card with form to create a new meeting.
// v2.5 – refactored: subject search + payment section moved to separate components.
//
// Patch v2.6:
// - After saving a Patient meeting, we keep the form in place and show the
//   Satisfaction Survey section below it (meetingId is now available).
// - Adds a "Yeni Görüşme" button to reset the card after survey (or anytime).
// - Avoids the old behavior of immediately clearing the form, which was breaking
//   the intended "save meeting then save survey" flow.

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
import { MeetingSatisfactionSurveySection } from './MeetingSatisfactionSurveySection';

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

  // Created meeting context for the survey flow
  const [createdMeetingId, setCreatedMeetingId] = useState<string | null>(null);
  const [createdPatientId, setCreatedPatientId] = useState<string | null>(null);

  const { mutateAsync, isPending, isError, error } =
    useCreateMeetingMutation();

  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.role === 'admin';

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

  const showPaymentSection =
    form.meetingType === 'patient' && !!form.subjectId;
  const showAccessorySection =
    form.meetingType === 'patient' && !!form.subjectId;

  const isSurveyFlowActive =
    !!createdMeetingId && !!createdPatientId;

  const disableMainForm = isPending || isSurveyFlowActive;

  const resetAll = () => {
    setForm(EMPTY_FORM);
    setAccessories([]);
    setShowAccessories(false);
    setCreatedMeetingId(null);
    setCreatedPatientId(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // When survey flow is active, user should start a new meeting instead.
    if (isSurveyFlowActive) return;

    const meetingId = await mutateAsync({ ...form, accessories });

    // Only Patient meetings can have satisfaction survey (needs patientId)
    if (form.meetingType === 'patient' && form.subjectId) {
      setCreatedMeetingId(meetingId);
      setCreatedPatientId(form.subjectId);
      return;
    }

    // For non-patient meeting types, keep old behavior (no survey)
    resetAll();
  };

  const handleSubjectSelect = (id: string, name: string) => {
    // If a meeting is already created, don't allow changing subject under it.
    if (isSurveyFlowActive) return;

    setForm((f) => ({
      ...f,
      subjectId: id,
      subjectName: name,
    }));
  };

  const handleAddAccessory = () => {
    if (isSurveyFlowActive) return;

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
    if (isSurveyFlowActive) return;

    setAccessories((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const handleAccessoryRemove = (index: number) => {
    if (isSurveyFlowActive) return;

    setAccessories((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="mb-1 text-sm font-semibold text-slate-900">
            Yeni Görüşme
          </h2>
          <p className="text-xs text-slate-500">
            Görüşme tipini, kişiyi, tarihleri ve notu girerek kayıt oluşturun.
            Senetli hastalar için bu ekrandan ödeme de kaydedebilirsiniz.
          </p>
        </div>

        {isSurveyFlowActive && (
          <button
            type="button"
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={resetAll}
          >
            Yeni Görüşme
          </button>
        )}
      </div>

      {isSurveyFlowActive && (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-xs text-emerald-800">
            Görüşme kaydedildi. Aşağıdan memnuniyet anketini doldurabilirsiniz.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Meeting type + person */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Görüşme Tipi
            </label>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
              value={form.meetingType}
              disabled={disableMainForm}
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

            <div className={disableMainForm ? 'pointer-events-none opacity-60' : ''}>
              <MeetingSubjectSearchField
                meetingType={form.meetingType}
                selectedName={form.subjectName}
                onSelect={handleSubjectSelect}
              />
            </div>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Başlık
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            value={form.subject}
            disabled={disableMainForm}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
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
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
              value={form.at}
              disabled={disableMainForm}
              onChange={(e) => setForm((f) => ({ ...f, at: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Sonraki Görüşme Tarihi
            </label>
            <input
              type="date"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
              value={form.next_at}
              disabled={disableMainForm}
              onChange={(e) =>
                setForm((f) => ({ ...f, next_at: e.target.value }))
              }
            />
          </div>
        </div>

        {/* Satisfaction (legacy 1–10 field) */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Memnuniyet (1–10)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
              value={form.satisfaction10}
              disabled={disableMainForm}
              onChange={(e) =>
                setForm((f) => ({ ...f, satisfaction10: e.target.value }))
              }
              placeholder="Boş bırakılabilir"
            />
          </div>
        </div>

        {/* Payment (senet) – only for patient meetings with selected person */}
        {showPaymentSection && form.subjectId && (
          <div className={disableMainForm ? 'pointer-events-none opacity-60' : ''}>
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
          </div>
        )}

        {showAccessorySection && (
          <div className="border-t border-dashed border-slate-200 pt-2">
            <button
              type="button"
              className="mt-1 text-[11px] text-slate-500 underline disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disableMainForm}
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
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                          value={acc.type}
                          disabled={disableMainForm}
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
                            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Aksesuar adı"
                            value={acc.customName}
                            disabled={disableMainForm}
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
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                          value={acc.costPrice}
                          disabled={disableMainForm}
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
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                          value={acc.salePrice}
                          disabled={disableMainForm}
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
                          className="text-[11px] text-red-600 underline disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={disableMainForm}
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
                  className="text-[11px] text-primary-600 underline disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={disableMainForm}
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
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            rows={3}
            value={form.note}
            disabled={disableMainForm}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
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
          disabled={
            isPending ||
            isSurveyFlowActive ||
            (form.meetingType === 'patient' && !form.subjectId)
          }
          className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          title={
            form.meetingType === 'patient' && !form.subjectId
              ? 'Hasta seçmeden görüşme kaydedilemez.'
              : undefined
          }
        >
          {isPending ? 'Kaydediliyor...' : 'Kaydet'}
        </button>

        {isSurveyFlowActive && (
          <p className="text-[11px] text-slate-500">
            Yeni görüşme girmek için sağ üstteki “Yeni Görüşme” butonunu kullanın.
          </p>
        )}
      </form>

      {/* Satisfaction Survey (only after patient meeting is created) */}
      {createdMeetingId && createdPatientId && (
        <MeetingSatisfactionSurveySection
          meetingId={createdMeetingId}
          patientId={createdPatientId}
        />
      )}
    </div>
  );
}
