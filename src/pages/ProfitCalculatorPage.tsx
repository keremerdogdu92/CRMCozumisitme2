// src/pages/ProfitCalculatorPage.tsx
// Summary: Page wrapper for the Profitability Calculator feature.

import React from "react";
import { ProfitCalculatorForm } from "../features/profitCalculator/ProfitCalculatorForm";
import { useCurrentProfile } from "../features/auth/useCurrentProfile";

const ProfitCalculatorPage: React.FC = () => {
  const { data: profile, isLoading } = useCurrentProfile();

  if (isLoading) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Kar hesaplama aracı yükleniyor...
      </div>
    );
  }

  // Only admins can see this page
  if (!profile || profile.role !== "admin") {
    return (
      <div className="p-8 text-sm text-slate-500">
        Bu sayfa sadece yöneticilere özeldir. Kar hesaplama araçları ve
        fiyat analizleri yalnızca yönetici hesaplarına açıktır.
      </div>
    );
  }

  return (
    <div className="p-4">
      <ProfitCalculatorForm />
    </div>
  );
};

export default ProfitCalculatorPage;
