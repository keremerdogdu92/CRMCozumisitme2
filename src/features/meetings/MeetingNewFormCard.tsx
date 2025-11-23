// src/features/meetings/MeetingNewFormCard.tsx
// Inline card with form to create a new meeting.

import { useState, FormEvent, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCreateMeetingMutation } from './api';
import type { MeetingType, NewMeetingForm } from './types';
import { useCurrentProfile } from '../auth/useCurrentProfile';
import { searchPatientsByName } from '../patients/api';
import { searchTrialsByName } from '../trials/api';

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
};

type SubjectOption = {
  id: string;
  name: string;
};

function useSubjectSearch(meetingType: MeetingType, term: string) {
  const enabledTypes: MeetingType[] = ['patient', 'trial'];

  return useQuery<SubjectOption[]>({
    queryKey: ['meeting-subject-search', meetingType, term],
    enabled:
      term.trim().length >= 2 && enabledTypes.includes(meetingType),
    queryFn: async () => {
      const q = term.trim();
      if (!q) return [];

      if (meetingType === 'patient') {
        const rows = await searchPatientsByName(q);
        return rows.map((r) => ({ id: r.id, name: r.full_name }));
      }

      if (meetingType === 'trial') {
        const rows = await searchTrialsByName(q);
        return rows.map((r) => ({ id: r.id, name: r.full_name }));
      }

      // For 'reference' we keep manual entry for now
      return [];
    },
  });
}

interface SubjectSearchFieldProps {
  meetingType: MeetingType;
  selectedName: string;
  onSelect: (id: string, name: string) => void;
}

function SubjectSearchField({
  meetingType,
  selectedName,
  onSelect,
}: SubjectSearchFieldProps) {
  const [inputValue, setInputValue] = useState(selectedName ?? '');
  const [touched, setTouched] = useState(false);

  const { data: options = [], isFetching } = useSubjectSearch(
    meetingType,
    inputValue,
  );

  // Sync external selectedName → local input when form resets
  useEffect(() => {
    if (!touched) {
      setInputValue(selectedName ?? '');
    }
  }, [selectedName, touched]);

  const showDropdown =
    inputValue.trim().length >= 2 && options.length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        value={inputValue}
        onChange={(e) => {
          setTouched(true);
          setInputValue(e.target.value);
        }}
        placeholder="İsimle ara (en az 2 harf)..."
      />
      <p className="mt-1 text-[11px] text-slate-500">
        {isFetching
          ? 'Kişiler aranıyor...'
          : 'Sonuçlardan birini seçtiğinizde görüşme bu kişiyle ilişkilendirilecek.'}
      </p>

      {showDropdown && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white text-xs shadow-lg">
          {options.map((opt) => (
            <li
              key={opt.id}
              className="cursor-pointer px-2 py-1 hover:bg-slate-100"
              onClick={() => {
                onSelect(opt.id, opt.name);
                setInputValue(opt.name);
                setTouched(false);
              }}
            >
              {opt.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MeetingNewFormCard() {
  const [form, setForm] = useState<NewMeetingForm>(EMPTY_FORM);
  const { mutateAsync, isPending, isError, error } =
    useCreateMeetingMutation();

  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.role === 'admin';

  // Personel için "reference" tipini UI'dan gizle
  const visibleTypeOptions = isAdmin
    ? MEETING_TYPE_OPTIONS
    : MEETING_TYPE_OPTIONS.filter((opt) => opt.value !== 'reference');

  // Eğer kullanıcı personel ise ama form state'de önceki oturumdan "reference" kalmışsa, düzelt
  useEffect(() => {
    if (!isAdmin && form.meetingType === 'reference') {
      setForm((f) => ({ ...f, meetingType: 'patient' }));
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

  const isReferenceType = form.meetingType === 'reference';

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">
        Yeni Görüşme
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Görüşme tipini, kişiyi, tarihleri ve notu girerek kayıt oluşturun.
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
                  // Tip değişince önceki seçimleri sıfırlamak daha temiz
                  subjectId: null,
                  subjectName: '',
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

            {isReferenceType ? (
              <>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                  value={form.subjectName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, subjectName: e.target.value }))
                  }
                  placeholder="Örn: Ali Yılmaz (referans adı)"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Referanslar için şimdilik serbest metin kullanılıyor.
                  İleride referans kartlarıyla da bağlayacağız.
                </p>
              </>
            ) : (
              <SubjectSearchField
                meetingType={form.meetingType}
                selectedName={form.subjectName}
                onSelect={handleSubjectSelect}
              />
            )}
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
