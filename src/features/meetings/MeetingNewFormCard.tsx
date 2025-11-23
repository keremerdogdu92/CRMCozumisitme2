// src/features/meetings/MeetingNewFormCard.tsx
// Inline card with form to create a new meeting.
// v2.4 – meeting_type + subject picker (patients, trials, references) + optional senet payment + senet plan summary.

import { useState, FormEvent, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCreateMeetingMutation } from './api';
import type { MeetingType, NewMeetingForm } from './types';
import { useCurrentProfile } from '../auth/useCurrentProfile';
import {
  searchPatientsByName,
  usePatientInstallmentPlan,
  usePatientPayments,
} from '../patients/api';
import { searchTrialsByName } from '../trials/api';
import { searchReferencesByName } from '../references/api';
import type {
  PatientInstallmentPlanRow,
  PatientPaymentRow,
} from '../patients/types';

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

type SubjectOption = {
  id: string;
  name: string;
};

function useSubjectSearch(meetingType: MeetingType, term: string) {
  // Bu picker; hasta, deneme hastası ve referans için çalışır.
  const enabledTypes: MeetingType[] = ['patient', 'trial', 'reference'];

  return useQuery<SubjectOption[]>({
    queryKey: ['meeting-subject-search', meetingType, term],
    enabled: term.trim().length >= 2 && enabledTypes.includes(meetingType),
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

      if (meetingType === 'reference') {
        const rows = await searchReferencesByName(q);
        return rows.map((r) => ({ id: r.id, name: r.full_name }));
      }

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
  const [isOpen, setIsOpen] = useState(false);

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
    isOpen && inputValue.trim().length >= 2 && options.length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        value={inputValue}
        onChange={(e) => {
          setTouched(true);
          setInputValue(e.target.value);
          setIsOpen(true);
        }}
        onBlur={() => {
          // Blur → dropdown'ı kısa bir gecikmeyle kapatıyoruz ki
          // liste elemanına tıklama çalışmaya devam etsin.
          setTimeout(() => setIsOpen(false), 120);
        }}
        placeholder="İsimle ara (en az 2 harf)..."
      />
      <p className="mt-1 text-[11px] text-slate-500">
        {isFetching
          ? 'Kişiler aranıyor...'
          : 'Sonuçlardan birini seçtiğinizde görüşme bu kartla ilişkilendirilecek.'}
      </p>

      {showDropdown && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white text-xs shadow-lg">
          {options.map((opt) => (
            <li
              key={opt.id}
              className="cursor-pointer px-2 py-1 hover:bg-slate-100"
              onMouseDown={(e) => {
                // onBlur'dan önce çalışsın diye onMouseDown kullanıyoruz
                e.preventDefault();
                onSelect(opt.id, opt.name);
                setInputValue(opt.name);
                setTouched(false);
                setIsOpen(false);
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

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '-';
  return (
    amount.toLocaleString('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + ' ₺'
  );
}

function addMonths(dateStr: string, count: number): string {
  try {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + count);
    return d.toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
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

  // Eğer hasta seçiliyse, aktif senet planını ve ödemeleri çek
  const {
    data: plan,
    isLoading: isPlanLoading,
  } = usePatientInstallmentPlan(
    showPaymentSection ? form.subjectId : null,
  );
  const { data: payments = [] } = usePatientPayments(
    showPaymentSection ? form.subjectId : null,
  );

  // Plan + ödemelerden bu taksitte beklenen tutarı ve kalan borcu hesapla
  let thisInstallmentAmount: number | null = null;
  let remainingTotal = 0;
  let nextDueDate = '-';

  if (plan) {
    const p = plan as PatientInstallmentPlanRow;
    const totalPaid = (payments as PatientPaymentRow[]).reduce(
      (sum, pay) => sum + (Number(pay.amount) || 0),
      0,
    );
    const remainingAfterUpfront =
      p.sale_total - p.upfront_paid;
    remainingTotal = Math.max(
      0,
      remainingAfterUpfront - totalPaid,
    );

    const perInstallment = p.installment_amount || 1;
    const paidInstallments = Math.min(
      p.installment_count,
      Math.floor(totalPaid / perInstallment),
    );
    nextDueDate = addMonths(p.first_due_date, paidInstallments);
    thisInstallmentAmount = perInstallment;
  }

  // Eğer plan var, ödeme kutusu açıldı ve henüz bir tutar yazılmadıysa, varsayılan olarak bu taksit tutarını doldur
  useEffect(() => {
    if (
      showPaymentSection &&
      plan &&
      !form.paymentAmount.trim() &&
      thisInstallmentAmount &&
      form.hasPayment
    ) {
      setForm((f) => ({
        ...f,
        paymentAmount: thisInstallmentAmount!.toString(),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPaymentSection, plan, thisInstallmentAmount, form.hasPayment]);

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
                  // Tip değişince önceki seçimleri sıfırlamak daha temiz
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

            <SubjectSearchField
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
        {showPaymentSection && (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            {/* Plan summary inside meeting form */}
            {isPlanLoading && (
              <p className="text-[11px] text-amber-900">
                Senet planı yükleniyor...
              </p>
            )}

            {plan && (
              <div className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-100 px-3 py-2">
                <div className="flex justify-between gap-2 text-[11px] text-amber-900">
                  <span>Bu taksit için beklenen tutar</span>
                  <span className="font-semibold">
                    {thisInstallmentAmount !== null
                      ? formatAmount(thisInstallmentAmount)
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between gap-2 text-[11px] text-amber-900">
                  <span>Kalan borç (yaklaşık)</span>
                  <span className="font-semibold">
                    {formatAmount(remainingTotal)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 text-[11px] text-amber-900">
                  <span>Sonraki taksit tarihi</span>
                  <span className="font-semibold">
                    {nextDueDate}
                  </span>
                </div>
              </div>
            )}

            {!plan && !isPlanLoading && (
              <p className="text-[11px] text-amber-900">
                Bu hasta için henüz senet planı yok. Hasta detayından
                &quot;Ödemeler&quot; sekmesinden plan oluşturabilirsiniz.
              </p>
            )}

            <div className="mt-1 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-amber-900">
                  Senet Ödemesi
                </p>
                <p className="text-[11px] text-amber-800">
                  Bu görüşmede senetli hastadan ödeme aldıysanız buradan
                  miktarı girin. Tutar hasta borç takibinde kullanılacak.
                </p>
              </div>
              <label className="flex items-center gap-1 text-[11px] text-amber-900">
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={form.hasPayment}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      hasPayment: e.target.checked,
                      paymentAmount: e.target.checked
                        ? f.paymentAmount
                        : '',
                      paymentNote: e.target.checked
                        ? f.paymentNote
                        : '',
                    }))
                  }
                />
                Ödeme alındı
              </label>
            </div>

            {form.hasPayment && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-amber-900">
                    Ödenen Tutar
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-amber-300 px-2 py-1 text-xs"
                    value={form.paymentAmount}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        paymentAmount: e.target.value,
                      }))
                    }
                    placeholder={
                      thisInstallmentAmount !== null
                        ? `Örn: ${thisInstallmentAmount}`
                        : 'Örn: 1250, 1.250,00'
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-amber-900">
                    Not (opsiyonel)
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-amber-300 px-2 py-1 text-xs"
                    value={form.paymentNote}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        paymentNote: e.target.value,
                      }))
                    }
                    placeholder="Örn: 3. taksit"
                  />
                </div>
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
