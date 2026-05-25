// src/features/finance/IncomeTaxCard.tsx

import { useMemo, useState } from 'react';
import {
  useIncomeTaxBrackets,
  useMonthlyTaxRecords,
  useSaveMonthlyTaxRecordMutation,
  type IncomeTaxBracket,
} from './taxApi';

type Props = {
  month: string;
  crmRevenue: number;
  inventoryCost: number;
};

type Draft = {
  revenueAdjustment: string;
  salaryExpense: string;
  rentExpense: string;
  otherExpense: string;
  notes: string;
};

function parseMoney(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function calculateCumulativeTax(
  cumulativeProfit: number,
  brackets: IncomeTaxBracket[],
): number {
  const bracket =
    brackets.find(
      (item) =>
        cumulativeProfit >= item.lower_bound &&
        (item.upper_bound == null || cumulativeProfit <= item.upper_bound),
    ) ?? brackets[brackets.length - 1];

  if (!bracket) return 0;

  return Math.max(
    0,
    bracket.base_tax + (cumulativeProfit - bracket.lower_bound) * bracket.rate,
  );
}

export function IncomeTaxCard({ month, crmRevenue, inventoryCost }: Props) {
  const [yearText, monthText] = month.split('-');
  const taxYear = Number(yearText);
  const taxMonth = Number(monthText);
  const { data: brackets } = useIncomeTaxBrackets(taxYear);
  const { data: records } = useMonthlyTaxRecords(taxYear);
  const saveMutation = useSaveMonthlyTaxRecordMutation(taxYear);

  const currentRecord = (records ?? []).find(
    (record) => record.tax_year === taxYear && record.tax_month === taxMonth,
  );

  const [draft, setDraft] = useState<Draft>({
    revenueAdjustment: currentRecord ? String(currentRecord.revenue_adjustment) : '',
    salaryExpense: currentRecord ? String(currentRecord.salary_expense) : '',
    rentExpense: currentRecord ? String(currentRecord.rent_expense) : '',
    otherExpense: currentRecord ? String(currentRecord.other_expense) : '',
    notes: currentRecord?.notes ?? '',
  });

  const calculation = useMemo(() => {
    const revenueAdjustment = parseMoney(draft.revenueAdjustment);
    const salaryExpense = parseMoney(draft.salaryExpense);
    const rentExpense = parseMoney(draft.rentExpense);
    const otherExpense = parseMoney(draft.otherExpense);
    const taxableProfit = Math.max(
      0,
      crmRevenue +
        revenueAdjustment -
        inventoryCost -
        salaryExpense -
        rentExpense -
        otherExpense,
    );
    const previousProfit = (records ?? [])
      .filter((record) => record.tax_year === taxYear && record.tax_month < taxMonth)
      .reduce((sum, record) => sum + record.taxable_profit, 0);
    const previousTax = calculateCumulativeTax(previousProfit, brackets ?? []);
    const cumulativeProfit = previousProfit + taxableProfit;
    const cumulativeTax = calculateCumulativeTax(cumulativeProfit, brackets ?? []);

    return {
      revenueAdjustment,
      salaryExpense,
      rentExpense,
      otherExpense,
      taxableProfit,
      cumulativeProfit,
      estimatedTax: Math.max(0, cumulativeTax - previousTax),
    };
  }, [brackets, crmRevenue, draft, inventoryCost, records, taxMonth, taxYear]);

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    saveMutation.mutate({
      taxYear,
      taxMonth,
      crmRevenue,
      revenueAdjustment: calculation.revenueAdjustment,
      salaryExpense: calculation.salaryExpense,
      rentExpense: calculation.rentExpense,
      otherExpense: calculation.otherExpense,
      inventoryCost,
      taxableProfit: calculation.taxableProfit,
      cumulativeTaxableProfit: calculation.cumulativeProfit,
      estimatedTax: calculation.estimatedTax,
      notes: draft.notes.trim() || null,
    });
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xs font-semibold text-slate-900">Gelir vergisi tahmini</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            CRM ciro ve stok maliyetiyle baslar; gider/duzeltme alanlari elle girilir.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {saveMutation.isPending ? 'Kaydediliyor...' : 'Ay kaydini kaydet'}
        </button>
      </div>

      <div className="mt-3 grid gap-3 text-xs md:grid-cols-3">
        <ReadOnlyMetric label="CRM ciro onerisi" value={crmRevenue} />
        <ReadOnlyMetric label="Stok maliyeti" value={inventoryCost} />
        <ReadOnlyMetric label="Tahmini vergi" value={calculation.estimatedTax} strong />

        <MoneyField
          label="Ciro duzeltmesi"
          value={draft.revenueAdjustment}
          onChange={(value) => patch('revenueAdjustment', value)}
        />
        <MoneyField
          label="Personel gideri"
          value={draft.salaryExpense}
          onChange={(value) => patch('salaryExpense', value)}
        />
        <MoneyField
          label="Kira gideri"
          value={draft.rentExpense}
          onChange={(value) => patch('rentExpense', value)}
        />
        <MoneyField
          label="Diger gider"
          value={draft.otherExpense}
          onChange={(value) => patch('otherExpense', value)}
        />
        <ReadOnlyMetric label="Vergiye esas kar" value={calculation.taxableProfit} />
        <ReadOnlyMetric label="Yillik kumulatif kar" value={calculation.cumulativeProfit} />

        <label className="space-y-1 md:col-span-3">
          <span className="font-medium text-slate-700">Not</span>
          <textarea
            rows={2}
            value={draft.notes}
            onChange={(event) => patch('notes', event.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </label>
      </div>

      {saveMutation.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {(saveMutation.error as Error).message}
        </p>
      )}
    </section>
  );
}

function ReadOnlyMetric({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={strong ? 'text-sm font-bold text-slate-900' : 'text-sm font-semibold text-slate-800'}>
        {formatMoney(value)} TL
      </div>
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
    </label>
  );
}
