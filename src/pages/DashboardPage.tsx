import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Wallet, BellRing, CreditCard } from 'lucide-react';
import { useCurrentProfile } from '../features/auth/useCurrentProfile';
import { fetchActiveDeviceRepairsSummary } from '../features/patients/api/api.repairs';

const DASHBOARD_METRICS = [
  {
    icon: <TrendingUp className="h-6 w-6 text-primary-500" />,
    label: 'Aylık Gelir',
    value: '?0',
    description: 'Satış verileri henüz bağlanmadı.',
  },
  {
    icon: <Wallet className="h-6 w-6 text-primary-500" />,
    label: 'Alacaklar',
    value: '?0',
    description: 'Tahsilat bilgileri için Supabase entegrasyonu gerekli.',
  },
  {
    icon: <CreditCard className="h-6 w-6 text-primary-500" />,
    label: 'Kredi Kartı Komisyonları',
    value: '?0',
    description: 'Net gelir hesaplaması için yapılandırma bekleniyor.',
  },
  {
    icon: <BellRing className="h-6 w-6 text-primary-500" />,
    label: 'Bekleyen Görevler',
    value: '0',
    description: 'Hatırlatmalar rapor fonksiyonları ile beslenecek.',
  },
];

function useActiveRepairsSummary() {
  const { data: profile } = useCurrentProfile();
  const orgId = profile?.org_id;

  return useQuery({
    queryKey: ['device-repairs-active-summary', orgId],
    enabled: !!orgId,
    queryFn: () => fetchActiveDeviceRepairsSummary(orgId as string),
  });
}

export default function DashboardPage() {
  const metrics = useMemo(() => DASHBOARD_METRICS, []);
  const { data: repairsSummary, isLoading: isRepairsLoading } =
    useActiveRepairsSummary();

  const hasActiveRepairs = !!repairsSummary && repairsSummary.total > 0;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Genel Bakış</h2>
        <p className="mt-1 text-sm text-slate-600">
          Supabase şeması tamamlandığında gerçek zamanlı hasta, ödeme ve stok verileri bu panelde
          görüntülenecek.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-primary-50 p-3">{metric.icon}</div>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-500">{metric.label}</p>
            <p className="text-2xl font-semibold text-slate-900">{metric.value}</p>
            <p className="mt-2 text-xs text-slate-500">{metric.description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          <h3 className="text-base font-semibold text-slate-900">Supabase Bağlantısı</h3>
          <p className="mt-2">
            Hasta kayıtları, görüşmeler ve stok durumları Supabase Postgres veritabanında tutulacak.
            RLS kuralları ile Admin ve Personel rolleri ayrıştırılacak. Bu panel TanStack Query ile
            gerçek zamanlı güncellenecek.
          </p>
        </article>
        <article className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          <h3 className="text-base font-semibold text-slate-900">Planlanan Özellikler</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Günlük e-posta raporları için Netlify fonksiyonu</li>
            <li>SGK süreci ve memnuniyet takibi</li>
            <li>Odyogram kaydı ve grafik görselleştirmesi</li>
            <li>Kar hesaplayıcı ve referans bazlı komisyon</li>
          </ul>
        </article>
      </section>

      {hasActiveRepairs && (
        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <h3 className="text-sm font-semibold">Tamirde Cihazlar</h3>
            <p className="mt-1 text-xs">
              Şu anda serviste veya teslim bekleyen {repairsSummary?.total ?? 0} cihaz var.
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {(['created', 'shipped', 'returned_waiting_meeting', 'scheduled'] as const).map(
                (status) => {
                  const byStatus = repairsSummary?.byStatus ?? {};
                  const count = byStatus[status] ?? 0;
                  if (!count) return null;

                  const labelMap: Record<string, string> = {
                    created: 'Kayıt açıldı',
                    shipped: 'Servise gönderildi',
                    returned_waiting_meeting: 'Klinikte, teslim bekliyor',
                    scheduled: 'Teslim için randevu ayarlandı',
                  };

                  return (
                    <li key={status} className="flex justify-between">
                      <span>{labelMap[status]}</span>
                      <span className="font-semibold">{count}</span>
                    </li>
                  );
                },
              )}
              {repairsSummary?.oldestOpen && (
                <li className="flex justify-between text-[11px] text-amber-800">
                  <span>En eski açık</span>
                  <span>{new Date(repairsSummary.oldestOpen).toLocaleDateString('tr-TR')}</span>
                </li>
              )}
            </ul>
            {isRepairsLoading && (
              <p className="mt-2 text-[11px] text-amber-800">Tamir verileri yükleniyor…</p>
            )}
          </article>
        </section>
      )}
    </div>
  );
}
