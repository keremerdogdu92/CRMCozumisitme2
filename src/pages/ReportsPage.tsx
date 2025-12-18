// src/pages/ReportsPage.tsx
// Summary: CRM reporting page – wraps ReportsDashboard and enforces auth.

import { ReportsDashboard } from '../features/reports/ReportsDashboard';
import { useCurrentProfile } from '../features/auth/useCurrentProfile';

export default function ReportsPage() {
  const { data: profile, isLoading } = useCurrentProfile();

  if (isLoading) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Raporlama sayfası yükleniyor...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Sadece giriş yapmış kullanıcılar raporları görebilir.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Raporlar</h1>
        <p className="text-sm text-slate-500">
          Toplam alacaklar, ciro, vergi, stok ve SGK ödeme beklentilerini ay bazında
          takip edin.
        </p>
      </div>

      <ReportsDashboard />
    </div>
  );
}
