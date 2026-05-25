import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useCreateMeetingMutation } from './api';
import type {
  MeetingAccessoryDraft,
  MeetingType,
  NewMeetingForm,
} from './types';
import type { MeetingSatisfactionDraft } from './meetingSatisfactionTypes';
import { useCurrentProfile } from '../auth/useCurrentProfile';
import { MeetingSubjectSearchField } from './MeetingSubjectSearchField';
import { MeetingPaymentSection } from './MeetingPaymentSection';
import { MeetingSatisfactionSurveySection } from './MeetingSatisfactionSurveySection';

const MEETING_TYPE_OPTIONS: { value: MeetingType; label: string }[] = [
  { value: 'patient', label: 'Hasta' },
  { value: 'trial', label: 'Deneme hastasi' },
  { value: 'reference', label: 'Referans' },
];

const EMPTY_FORM: NewMeetingForm = {
  meetingType: 'patient',
  subjectId: null,
  subjectName: '',
  subject: '',
  note: '',
  at: '',
  next_at: '',
  satisfaction: null,
  hasPayment: false,
  paymentAmount: '',
  paymentNote: '',
};

const ACCESSORY_TYPE_OPTIONS: {
  value: MeetingAccessoryDraft['type'];
  label: string;
}[] = [
  { value: 'Dom', label: 'Dom' },
  { value: 'Kulak Kalıbı', label: 'Kulak Kalibi' },
  { value: 'Receiver', label: 'Receiver' },
  { value: 'Filtre', label: 'Filtre' },
  { value: 'Pil', label: 'Pil' },
  { value: 'Diğer', label: 'Diger' },
];

export function MeetingNewFormCard() {
  const [form, setForm] = useState<NewMeetingForm>(EMPTY_FORM);
  const [accessories, setAccessories] = useState<MeetingAccessoryDraft[]>([]);
  const [showAccessories, setShowAccessories] = useState(false);

  const { mutateAsync, isPending, isError, error } =
    useCreateMeetingMutation();
  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.role === 'admin';

  const visibleTypeOptions = isAdmin
    ? MEETING_TYPE_OPTIONS
    : MEETING_TYPE_OPTIONS.filter((opt) => opt.value !== 'reference');

  useEffect(() => {
    if (!isAdmin && form.meetingType === 'reference') {
      setForm((current) => ({
        ...current,
        meetingType: 'patient',
        subjectId: null,
        subjectName: '',
        hasPayment: false,
        paymentAmount: '',
        paymentNote: '',
        satisfaction: null,
      }));
    }
  }, [isAdmin, form.meetingType]);

  useEffect(() => {
    if (form.meetingType !== 'patient') {
      setAccessories([]);
      setShowAccessories(false);
      setForm((current) => ({ ...current, satisfaction: null }));
    }
  }, [form.meetingType]);

  const resetAll = () => {
    setForm(EMPTY_FORM);
    setAccessories([]);
    setShowAccessories(false);
  };

  const handleSatisfactionDraftChange = useCallback(
    (draft: MeetingSatisfactionDraft) => {
      setForm((current) => ({
        ...current,
        satisfaction: draft,
      }));
    },
    [],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await mutateAsync({ ...form, accessories });
    resetAll();
  }

  function handleMeetingTypeChange(nextType: MeetingType) {
    setForm((current) => ({
      ...current,
      meetingType: nextType,
      subjectId: null,
      subjectName: '',
      hasPayment: false,
      paymentAmount: '',
      paymentNote: '',
      satisfaction: null,
    }));
  }

  function handleSubjectSelect(id: string, name: string) {
    setForm((current) => ({
      ...current,
      subjectId: id,
      subjectName: name,
      satisfaction: null,
    }));
  }

  function handleAddAccessory() {
    const localId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `acc-${Date.now()}-${Math.random()}`;

    setAccessories((current) => [
      ...current,
      {
        id: localId,
        type: 'Dom',
        customName: '',
        costPrice: '',
        salePrice: '',
      },
    ]);
  }

  function handleAccessoryChange(
    index: number,
    patch: Partial<MeetingAccessoryDraft>,
  ) {
    setAccessories((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function handleAccessoryRemove(index: number) {
    setAccessories((current) =>
      current.filter((_, rowIndex) => rowIndex !== index),
    );
  }

  const showPaymentSection =
    form.meetingType === 'patient' && !!form.subjectId;
  const showAccessorySection =
    form.meetingType === 'patient' && !!form.subjectId;
  const disableMainForm = isPending;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">
          Yeni Gorusme
        </h2>
        <p className="text-xs text-slate-500">
          Gorusme tipini, kisiyi, tarihleri ve notu girerek kayit olusturun.
          Senetli hastalar icin bu ekrandan odeme de kaydedebilirsiniz.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Gorusme Tipi
            </label>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
              value={form.meetingType}
              disabled={disableMainForm}
              onChange={(event) =>
                handleMeetingTypeChange(event.target.value as MeetingType)
              }
            >
              {visibleTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Referans gorusmeleri yalnizca admin kullanicilar tarafindan
              gorulebilir.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Gorusme Yapilan Kisi
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

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Baslik
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            value={form.subject}
            disabled={disableMainForm}
            onChange={(event) =>
              setForm((current) => ({ ...current, subject: event.target.value }))
            }
            placeholder="Orn: Ayar kontrolu, ilk gorusme..."
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Gorusme Tarihi
            </label>
            <input
              type="date"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
              value={form.at}
              disabled={disableMainForm}
              onChange={(event) =>
                setForm((current) => ({ ...current, at: event.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Sonraki Gorusme Tarihi
            </label>
            <input
              type="date"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
              value={form.next_at}
              disabled={disableMainForm}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  next_at: event.target.value,
                }))
              }
            />
          </div>
        </div>

        {form.meetingType === 'patient' && form.subjectId && (
          <MeetingSatisfactionSurveySection
            patientId={form.subjectId}
            mode="draft"
            disabled={disableMainForm}
            onDraftChange={handleSatisfactionDraftChange}
          />
        )}

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
                setForm((current) => ({
                  ...current,
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
              onClick={() => setShowAccessories((value) => !value)}
            >
              Aksesuar ekle (opsiyonel)
            </button>

            {showAccessories && (
              <div className="mt-2 space-y-2 rounded-md border border-slate-200 p-3">
                {accessories.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    Bu gorusme icin aksesuar eklenmedi.
                  </p>
                )}

                {accessories.map((accessory, index) => {
                  const isOther = accessory.type === 'Diğer';
                  return (
                    <div
                      key={accessory.id ?? index}
                      className="grid gap-2 rounded-md bg-slate-50 p-2 sm:grid-cols-4"
                    >
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-[11px] text-slate-600">
                          Aksesuar
                        </label>
                        <select
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                          value={accessory.type}
                          disabled={disableMainForm}
                          onChange={(event) =>
                            handleAccessoryChange(index, {
                              type: event.target.value as MeetingAccessoryDraft['type'],
                            })
                          }
                        >
                          {ACCESSORY_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {isOther && (
                          <input
                            type="text"
                            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Aksesuar adi"
                            value={accessory.customName}
                            disabled={disableMainForm}
                            onChange={(event) =>
                              handleAccessoryChange(index, {
                                customName: event.target.value,
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
                          value={accessory.costPrice}
                          disabled={disableMainForm}
                          onChange={(event) =>
                            handleAccessoryChange(index, {
                              costPrice: event.target.value,
                            })
                          }
                          placeholder="Opsiyonel"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] text-slate-600">
                          Hastadan alinan (TL)
                        </label>
                        <input
                          type="text"
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                          value={accessory.salePrice}
                          disabled={disableMainForm}
                          onChange={(event) =>
                            handleAccessoryChange(index, {
                              salePrice: event.target.value,
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
                  Aksesuar satiri ekle
                </button>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Not
          </label>
          <textarea
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            rows={3}
            value={form.note}
            disabled={disableMainForm}
            onChange={(event) =>
              setForm((current) => ({ ...current, note: event.target.value }))
            }
            placeholder="Gorusme icerigi, yapilan islemler, notlar..."
          />
        </div>

        {isError && (
          <p className="text-xs text-red-600">
            Kayit sirasinda bir hata olustu:{' '}
            {(error as Error)?.message ?? 'Bilinmeyen hata'}
          </p>
        )}

        <button
          type="submit"
          disabled={
            isPending ||
            (form.meetingType === 'patient' && !form.subjectId)
          }
          className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          title={
            form.meetingType === 'patient' && !form.subjectId
              ? 'Hasta secmeden gorusme kaydedilemez.'
              : undefined
          }
        >
          {isPending ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </form>
    </div>
  );
}
