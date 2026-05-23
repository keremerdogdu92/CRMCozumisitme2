import { useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  const stockWarnings = data?.stockWarnings ?? [];

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
              to="/settings"
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
            to="/settings"
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
    </div>
  );
}
