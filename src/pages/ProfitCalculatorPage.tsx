// src/pages/ProfitCalculatorPage.tsx
// Summary: Page wrapper for the Profitability Calculator feature.

import React from "react";
import { ProfitCalculatorForm } from "../features/profitCalculator/ProfitCalculatorForm";

const ProfitCalculatorPage: React.FC = () => {
  return (
    <div className="p-4">
      <ProfitCalculatorForm />
    </div>
  );
};

export default ProfitCalculatorPage;
