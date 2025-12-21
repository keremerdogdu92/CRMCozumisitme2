// src/features/meetings/MeetingNewFormCard.tsx
// Inline card with form to create a new meeting.
// v2.5 – refactored: subject search + payment section moved to separate components.
// v2.7 – satisfaction: 5-question survey (1–5 scale) instead of manual 1–10 input.
//        - Anket soruları meetingSatisfactionTypes.ts içindeki havuzdan geliyor.
//        - Cevapların ortalaması alınarak 1–10 skalasına çevrilip meetings.satisfaction_10'a yazılıyor.

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
import {
  SATISFACTION_OPTIONS,
  type SatisfactionScore,
  type MeetingSatisfactionQuestionWithAnswer,
  getSurveyQuestionsForPatient,
  markQuestionsAnsweredForPatient,
} from './meetingSatisfactionTypes';

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

  // Memnuniyet anketi state
  const [surveyQuestions, setSurveyQuestions] = useState<
    MeetingSatisfactionQuestionWithAnswer[]
  >([]);
  const [surveyError, setSurveyError] = useState<string | null>(null);

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
      setSurveyQuestions([]);
      setSurveyError(null);
    }
  }, [isAdmin, form.meetingType]);

  useEffect(() => {
    if (form.meetingType !== 'patient') {
      setAccessories([]);
      setShowAccessories(false);
      setSurveyQuestions([]);
      setSurveyError(null);
    }
  }, [form.meetingType]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // 1) Anketten ortalama memnuniyet skoru hesapla (1–5)
    let satisfaction10 = '';

    if (surveyQuestions.length > 0) {
      const answered = surveyQuestions.filter((q) => q.score != null);

      if (answered.length > 0) {
        const total = answered.reduce(
          (sum, q) => sum + (q.score as SatisfactionScore),
          0,
        );
        const avg5 = total / answered.length; // 1–5 aralığında

        // 1–5 → 1–10 map: (avg5 / 5) * 10
        const mapped10 = Math.round((avg5 / 5) * 10);
        const clamped10 = Math.min(10, Math.max(1, mapped10));
        satisfaction10 = String(clamped10);
      }
    }

    await mutateAsync({
      ...form,
      satisfaction10,
      accessories,
    });

    // 2) Soruları "bu hasta için soruldu" olarak işaretle
    if (form.subjectId && surveyQuestions.length > 0) {
      const answeredIds = surveyQuestions
        .filter((q) => q.score != null)
        .map((q) => q.id);
      if (answeredIds.length > 0) {
        markQuestionsAnsweredForPatient(form.subjectId, answeredIds);
      }
    }

    // 3) Formu sıfırla
    setForm(EMPTY_FORM);
    setAccessories([]);
    setShowAccessories(false);
    setSurveyQuestions([]);
    setSurveyError(null);
  };

  const handleSubjectSelect = (id: string, name: string) => {
    setForm((f) => ({
      ...f,
      subjectId: id,
      subjectName: name,
    }));
    // Kişi değişince yeni anket hazırlansın diye eski soruları temizle
    setSurveyQuestions([]);
    setSurveyError(null);
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

  const handlePrepareSurvey = () => {
    if (!form.subjectId) {
      setSurveyError('Anket için önce görüşme yapılan kişiyi seçin.');
      return;
    }
    const questions = getSurveyQuestionsForPatient(form.subjectId);
    setSurveyQuestions(questions);
    setSurveyError(null);
  };

  const handleSurveyAnswerChange = (
    questionId: string,
    score: SatisfactionScore,
  ) => {
    setSurveyQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? {
              ...q,
              score,
            }
          : q,
      ),
    );
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
              onChange={(e) => {
                const nextType = e.target.value as MeetingType;
                setForm((f) => ({
                  ...f,
                  meetingType: nextType,
                  // Reset subject & payment when type changes
                  subjectId: null,
                  subjectName: '',
                  hasPayment: false,
                  paymentAmount: '',
                  paymentNote: '',
                }));
                setSurveyQuestions([]);
                setSurveyError(null);
              }}
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

        {/* Satisfaction survey – 5 questions (1–5) */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Memnuniyet Anketi (1–5)
          </label>
          <p className="text-[11px] text-slate-500">
            1: Hiç memnun değilim · 2: Memnun değilim · 3: Normal · 4:
            Memnunum · 5: Çok memnunum
          </p>

          {!form.subjectId && (
            <p className="mt-1 text-[11px] text-orange-600">
              Anketi başlatmak için önce görüşme yapılan kişiyi seçin.
            </p>
          )}

          {form.subjectId && surveyQuestions.length === 0 && (
            <button
              type="button"
              className="mt-2 inline-flex items-center rounded-md border border-primary-500 px-2 py-1 text-[11px] font-medium text-primary-700 hover:bg-primary-50"
              onClick={handlePrepareSurvey}
              disabled={isPending}
            >
              5 soruluk memnuniyet anketini başlat
            </button>
          )}

          {surveyError && (
            <p className="mt-1 text-[11px] text-red-600">{surveyError}</p>
          )}

          {surveyQuestions.length > 0 && (
            <div className="mt-2 space-y-2 rounded-md border border-slate-200 p-3">
              {surveyQuestions.map((q, index) => (
                <div
                  key={q.id}
                  className="rounded-md bg-slate-50 p-2"
                >
                  <p className="text-[11px] font-medium text-slate-800">
                    {index + 1}. {q.text}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {SATISFACTION_OPTIONS.map((opt) => {
                      const active = q.score === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={`rounded-md border px-2 py-1 text-[11px] ${
                            active
                              ? 'border-primary-500 bg-primary-50 font-semibold text-primary-800'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                          onClick={() =>
                            handleSurveyAnswerChange(q.id, opt.value)
                          }
                          disabled={isPending}
                        >
                          {opt.value}. {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
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
