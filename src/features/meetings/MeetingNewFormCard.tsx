// src/features/meetings/MeetingNewFormCard.tsx
// Inline card with form to create a new meeting.
// v2.5 – refactored: subject search + payment section moved to separate components.

import { useState, FormEvent, useEffect } from 'react';
import { useCreateMeetingMutation } from './api';
import type { MeetingType, NewMeetingForm } from './types';
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

export function MeetingNewFormCard() {
  const [form, setForm] = useState<NewMeetingForm>(EMPTY_FORM);
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await mutateAsync(form);
    setForm(EMPTY_FORM);
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
