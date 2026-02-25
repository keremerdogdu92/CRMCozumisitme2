// src/pages/ProfitCalculatorPage.tsx
// Summary: Page wrapper for the Profitability Calculator feature (admin-only).

import { ProfitCalculatorForm } from '../features/profitCalculator/ProfitCalculatorForm';
import { ProfitCalculatorQuickCommission } from '../features/profitCalculator/components/ProfitCalculatorQuickCommission';
import { useCurrentProfile } from '../features/auth/useCurrentProfile';

export default function ProfitCalculatorPage() {
  const { data: profile, isLoading } = useCurrentProfile();

  if (isLoading) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Kar hesaplama aracı yükleniyor...
      </div>
    );
  }

  // Only admins can see this page
  if (!profile || profile.role !== 'admin') {
    return (
      <div className="p-8 text-sm text-slate-500">
        Bu sayfa sadece yöneticilere özeldir. Kar hesaplama araçları ve fiyat
        analizleri yalnızca yönetici hesaplarına açıktır.
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {/* Üstte hızlı komisyon aracı */}
      <ProfitCalculatorQuickCommission />

      {/* Asıl karlılık hesaplama formu */}
      <ProfitCalculatorForm />
    </div>
  );
}
