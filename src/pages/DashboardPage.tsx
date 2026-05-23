import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrentProfile } from '../features/auth/useCurrentProfile';
import {
  createDashboardFollowUpMeeting,
  type CreateDashboardFollowUpMeetingInput,
  useDashboard,
} from '../features/dashboard/api';
import type { UpcomingMeetingItem } from '../features/dashboard/types';

type MetricRow = {
  label: string;
  value: number | undefined;
  hint?: string;
};

type FollowUpFormState = {
  subject: string;
  note: string;
  at: string;
  nextAt: string;
};

function getIstanbulMonthStartIso(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';

  return `${year}-${month}-01T00:00:00+03:00`;
}

function getIstanbulDateInputValue(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function dateInputToIstanbulIso(value: string): string {
  return new Date(`${value}T12:00:00+03:00`).toISOString();
}

function createFollowUpFormState(): FollowUpFormState {
  return {
    subject: 'Telefon gorusmesi',
    note: '',
    at: getIstanbulDateInputValue(new Date()),
    nextAt: '',
  };
}

export default function DashboardPage() {
  const monthStartIso = useMemo(() => getIstanbulMonthStartIso(new Date()), []);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useDashboard(monthStartIso);
  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.role === 'admin';
  const kpis = data?.kpis;
  const upcoming = data?.upcomingMeetings ?? [];
  const stockWarnings = data?.stockWarnings ?? [];
  const [activeFollowUp, setActiveFollowUp] =
    useState<UpcomingMeetingItem | null>(null);
  const [followUpForm, setFollowUpForm] = useState<FollowUpFormState>(
    createFollowUpFormState,
  );
  const [followUpFormError, setFollowUpFormError] = useState<string | null>(
    null,
  );

  const followUpMutation = useMutation<
    string,
    Error,
    CreateDashboardFollowUpMeetingInput
  >({
    mutationFn: createDashboardFollowUpMeeting,
    onSuccess: () => {
      setActiveFollowUp(null);
      setFollowUpForm(createFollowUpFormState());
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] === 'dashboard' || q.queryKey[0] === 'meetings'),
      });
    },
  });

  const operationalRows: MetricRow[] = [
    { label: 'SGK Sisteme Girilen', value: kpis?.sgkEnteredThisMonthTotal },
    { label: 'SGK Beklenen', value: kpis?.sgkDueThisMonthTotal },
    { label: 'Pil SGK Beklenen', value: kpis?.batterySgkDueThisMonthTotal },
    { label: 'Satilan Cihaz', value: kpis?.devicesSoldCount },
    { label: 'Cihaz Alan Hasta', value: kpis?.devicePatientsCount },
    {
      label: 'Bekleyen Taksit',
      value: kpis?.unpaidInstallmentsDueThisMonth,
      hint: 'Senet taksit tahsilati plan bazli yaklasik hesaplanir.',
    },
    {
      label: 'Kritik Stok Modeli',
      value: kpis?.criticalStockModelCount,
      hint: 'Stok 0 olan ve esik tanimli katalog modelleri.',
    },
    {
      label: 'Dusuk Stok Modeli',
      value: kpis?.lowStockModelCount,
      hint: 'Stok adedi tanimli minimum esige inen modeller.',
    },
    {
      label: 'Stok Import Hatasi',
      value: kpis?.inventoryImportErrorRowCount,
      hint: 'Duzeltilmemis stok import hata satiri.',
    },
  ];

  const adminRows: MetricRow[] = [
    { label: 'Aylik Gelir', value: kpis?.revenueTotal },
    { label: 'Kart Komisyonu', value: kpis?.cardFeeTotal },
    { label: 'Referans Komisyonu', value: kpis?.referenceCommissionTotal },
  ];

  const rows = isAdmin ? [...adminRows, ...operationalRows] : operationalRows;

  function openFollowUpModal(item: UpcomingMeetingItem) {
    setActiveFollowUp(item);
    setFollowUpForm(createFollowUpFormState());
    setFollowUpFormError(null);
    followUpMutation.reset();
  }

  function closeFollowUpModal() {
    if (followUpMutation.isPending) return;
    setActiveFollowUp(null);
    setFollowUpFormError(null);
  }

  function handleFollowUpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeFollowUp) return;

    const subject = followUpForm.subject.trim();
    if (!subject) {
      setFollowUpFormError('Baslik zorunludur.');
      return;
    }

    if (!followUpForm.at) {
      setFollowUpFormError('Gorusme tarihi zorunludur.');
      return;
    }

    setFollowUpFormError(null);
    followUpMutation.mutate({
      sourceMeetingId: activeFollowUp.id,
      subject,
      note: followUpForm.note.trim() || null,
      at: dateInputToIstanbulIso(followUpForm.at),
      nextAt: followUpForm.nextAt
        ? dateInputToIstanbulIso(followUpForm.nextAt)
        : null,
      satisfaction10: null,
    });
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Genel Bakis</h2>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((metric) => (
          <article
            key={metric.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {isLoading ? '...' : metric.value ?? 0}
            </p>
            {metric.hint && (
              <p className="mt-1 text-xs text-slate-500">{metric.hint}</p>
            )}
          </article>
        ))}
      </section>

      {isError && (
        <p className="text-sm text-red-600">
          {(error as Error)?.message ??
            'DASHBOARD_KPIS_RPC_FAILED: Unknown error'}
        </p>
      )}

      {(kpis?.importErrorJobCount ?? 0) > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Import hatalari var</p>
              <p className="text-xs">
                Hatali job: {kpis?.importErrorJobCount ?? 0} | Stok hata satiri:{' '}
                {kpis?.inventoryImportErrorRowCount ?? 0}
              </p>
            </div>
            <Link
              to="/settings?tab=imports&focus=fix-center"
              className="text-xs font-semibold text-amber-900 underline"
            >
              Import Fix Center
            </Link>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">
          Yaklasan Gorusmeler
        </h3>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {isLoading && <p className="text-sm text-slate-500">Yukleniyor...</p>}
          {!isLoading && upcoming.length === 0 && (
            <p className="text-sm text-slate-500">Yaklasan gorusme uyarisi yok.</p>
          )}
          {!isLoading && upcoming.length > 0 && (
            <ul className="space-y-2 text-sm">
              {upcoming.map((item) => {
                const dt = item.followUpAt ?? item.nextAt ?? item.at;
                const displayDate = dt
                  ? new Date(dt).toLocaleString('tr-TR', {
                      timeZone: 'Europe/Istanbul',
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })
                  : 'Tarih bekleniyor';
                const isError = item.alertSeverity === 'error';

                return (
                  <li
                    key={item.id}
                    className={
                      'flex items-start justify-between gap-3 rounded-md border px-3 py-2 ' +
                      (isError
                        ? 'border-red-200 bg-red-50'
                        : 'border-amber-200 bg-amber-50')
                    }
                  >
                    <div>
                      <p
                        className={
                          'font-medium ' +
                          (isError ? 'text-red-900' : 'text-amber-900')
                        }
                      >
                        {item.subjectName || item.subject || 'Baslik yok'}
                      </p>
                      <p
                        className={
                          'text-xs ' +
                          (isError ? 'text-red-700' : 'text-amber-700')
                        }
                      >
                        {isError ? 'Bugun/gecikmis' : '3 gun icinde'} - Tip:{' '}
                        {item.meetingType} - {displayDate}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openFollowUpModal(item)}
                      className={
                        'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ' +
                        (isError
                          ? 'bg-red-100 text-red-800 hover:bg-red-200'
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200')
                      }
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      Gorusme gir
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">
            Stok Uyarilari
          </h3>
          <Link
            to="/settings?tab=catalog-stock"
            className="text-xs font-medium text-primary-700 hover:text-primary-800"
          >
            Esikleri yonet
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {isLoading && <p className="text-sm text-slate-500">Yukleniyor...</p>}
          {!isLoading && stockWarnings.length === 0 && (
            <p className="text-sm text-slate-500">
              Esik tanimli kritik veya dusuk stok yok.
            </p>
          )}
          {!isLoading && stockWarnings.length > 0 && (
            <ul className="space-y-2 text-sm">
              {stockWarnings.map((item) => {
                const isError = item.severity === 'error';

                return (
                  <li
                    key={item.catalogModelId}
                    className={
                      'flex items-center justify-between gap-3 rounded-md border px-3 py-2 ' +
                      (isError
                        ? 'border-red-200 bg-red-50'
                        : 'border-amber-200 bg-amber-50')
                    }
                  >
                    <div>
                      <p
                        className={
                          'font-medium ' +
                          (isError ? 'text-red-900' : 'text-amber-900')
                        }
                      >
                        {item.brand} {item.model}
                      </p>
                      <p
                        className={
                          'text-xs ' +
                          (isError ? 'text-red-700' : 'text-amber-700')
                        }
                      >
                        {item.itemType} - Stok: {item.inStockCount} / Esik:{' '}
                        {item.minimumStock} ({item.thresholdScope})
                      </p>
                    </div>
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
                        (isError
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800')
                      }
                    >
                      {isError ? 'Kritik' : 'Dusuk'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {activeFollowUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-lg">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Gorusme gir
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {activeFollowUp.subjectName ||
                  activeFollowUp.subject ||
                  'Kayit'}{' '}
                icin takip uyarisi, bu gorusme kaydedildikten sonra kapanir.
              </p>
            </div>

            <form className="space-y-3" onSubmit={handleFollowUpSubmit}>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Baslik
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={followUpForm.subject}
                  onChange={(event) =>
                    setFollowUpForm((form) => ({
                      ...form,
                      subject: event.target.value,
                    }))
                  }
                  placeholder="Orn: Telefon gorusmesi"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Not
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={followUpForm.note}
                  onChange={(event) =>
                    setFollowUpForm((form) => ({
                      ...form,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Orn: Telefon acildi, acilmadi, tekrar aranacak..."
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Gorusme tarihi
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={followUpForm.at}
                    onChange={(event) =>
                      setFollowUpForm((form) => ({
                        ...form,
                        at: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Yeni sonraki gorusme
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={followUpForm.nextAt}
                    onChange={(event) =>
                      setFollowUpForm((form) => ({
                        ...form,
                        nextAt: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {(followUpFormError || followUpMutation.error) && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  {followUpFormError || followUpMutation.error?.message}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeFollowUpModal}
                  disabled={followUpMutation.isPending}
                  className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Vazgec
                </button>
                <button
                  type="submit"
                  disabled={followUpMutation.isPending}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  {followUpMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
