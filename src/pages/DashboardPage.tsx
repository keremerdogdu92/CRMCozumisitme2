import { useMemo } from 'react';
import { useCurrentProfile } from '../features/auth/useCurrentProfile';
import { useDashboard } from '../features/dashboard/api';

type MetricRow = {
  label: string;
  value: number | undefined;
  hint?: string;
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

export default function DashboardPage() {
  const monthStartIso = useMemo(() => getIstanbulMonthStartIso(new Date()), []);

  const { data, isLoading, isError, error } = useDashboard(monthStartIso);
  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.role === 'admin';
  const kpis = data?.kpis;
  const upcoming = data?.upcomingMeetings ?? [];

  const operationalRows: MetricRow[] = [
    { label: 'SGK Sisteme Girilen', value: kpis?.sgkEnteredThisMonthTotal },
    { label: 'SGK Beklenen', value: kpis?.sgkDueThisMonthTotal },
    { label: 'Pil SGK Beklenen', value: kpis?.batterySgkDueThisMonthTotal },
    { label: 'Satılan Cihaz', value: kpis?.devicesSoldCount },
    { label: 'Cihaz Alan Hasta', value: kpis?.devicePatientsCount },
    {
      label: 'Bekleyen Taksit',
      value: kpis?.unpaidInstallmentsDueThisMonth,
      hint: 'Senet taksit tahsilatı plan bazlı yaklaşık hesaplanır.',
    },
  ];

  const adminRows: MetricRow[] = [
    { label: 'Aylık Gelir', value: kpis?.revenueTotal },
    { label: 'Kart Komisyonu', value: kpis?.cardFeeTotal },
    { label: 'Referans Komisyonu', value: kpis?.referenceCommissionTotal },
  ];

  const rows = isAdmin ? [...adminRows, ...operationalRows] : operationalRows;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Genel Bakış</h2>
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

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">
          Yaklaşan Görüşmeler
        </h3>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {isLoading && <p className="text-sm text-slate-500">Yükleniyor...</p>}
          {!isLoading && upcoming.length === 0 && (
            <p className="text-sm text-slate-500">Yaklaşan görüşme yok.</p>
          )}
          {!isLoading && upcoming.length > 0 && (
            <ul className="space-y-2 text-sm">
              {upcoming.map((item) => {
                const dt = item.at ?? item.nextAt;
                const displayDate = dt
                  ? new Date(dt).toLocaleString('tr-TR', {
                      timeZone: 'Europe/Istanbul',
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })
                  : 'Tarih bekleniyor';
                return (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {item.subjectName || item.subject || 'Başlık yok'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Tip: {item.meetingType} - {displayDate}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
