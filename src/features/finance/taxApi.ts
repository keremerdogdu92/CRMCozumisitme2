// src/features/finance/taxApi.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';

export type IncomeTaxBracket = {
  id: string;
  org_id: string | null;
  tax_year: number;
  lower_bound: number;
  upper_bound: number | null;
  rate: number;
  base_tax: number;
};

export type MonthlyTaxRecord = {
  id: string;
  org_id: string;
  tax_year: number;
  tax_month: number;
  crm_revenue: number;
  revenue_adjustment: number;
  salary_expense: number;
  rent_expense: number;
  other_expense: number;
  inventory_cost: number;
  taxable_profit: number;
  cumulative_taxable_profit: number;
  estimated_tax: number;
  notes: string | null;
};

export type SaveMonthlyTaxRecordInput = {
  taxYear: number;
  taxMonth: number;
  crmRevenue: number;
  revenueAdjustment: number;
  salaryExpense: number;
  rentExpense: number;
  otherExpense: number;
  inventoryCost: number;
  taxableProfit: number;
  cumulativeTaxableProfit: number;
  estimatedTax: number;
  notes: string | null;
};

export const MONTHLY_TAX_QUERY_KEY = (year: number) => ['monthly-tax-records', year] as const;
export const INCOME_TAX_BRACKETS_QUERY_KEY = (year: number) => ['income-tax-brackets', year] as const;

async function getCurrentProfileContext(): Promise<{ userId: string; orgId: string }> {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw new Error('TAX_USER: ' + userError.message);
  const user = userData.user;
  if (!user) throw new Error('TAX_USER: Kullanici oturumu bulunamadi.');

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, org_id')
    .eq('id', user.id)
    .single();

  if (error) throw new Error('TAX_PROFILE: ' + error.message);
  if (!data?.org_id) throw new Error('TAX_NO_ORG: Profilde org_id bulunamadi.');
  return { userId: data.id as string, orgId: data.org_id as string };
}

function toMonthlyTaxRecord(row: Record<string, unknown>): MonthlyTaxRecord {
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    tax_year: Number(row.tax_year),
    tax_month: Number(row.tax_month),
    crm_revenue: Number(row.crm_revenue ?? 0),
    revenue_adjustment: Number(row.revenue_adjustment ?? 0),
    salary_expense: Number(row.salary_expense ?? 0),
    rent_expense: Number(row.rent_expense ?? 0),
    other_expense: Number(row.other_expense ?? 0),
    inventory_cost: Number(row.inventory_cost ?? 0),
    taxable_profit: Number(row.taxable_profit ?? 0),
    cumulative_taxable_profit: Number(row.cumulative_taxable_profit ?? 0),
    estimated_tax: Number(row.estimated_tax ?? 0),
    notes: (row.notes as string | null) ?? null,
  };
}

export async function fetchIncomeTaxBrackets(year: number): Promise<IncomeTaxBracket[]> {
  const { data, error } = await supabaseClient
    .from('income_tax_brackets')
    .select('*')
    .eq('tax_year', year)
    .order('org_id', { ascending: false, nullsFirst: false })
    .order('lower_bound', { ascending: true });

  if (error) throw new Error('TAX_BRACKETS: ' + error.message);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    org_id: (row.org_id as string | null) ?? null,
    tax_year: Number(row.tax_year),
    lower_bound: Number(row.lower_bound ?? 0),
    upper_bound: row.upper_bound == null ? null : Number(row.upper_bound),
    rate: Number(row.rate ?? 0),
    base_tax: Number(row.base_tax ?? 0),
  }));
}

export async function fetchMonthlyTaxRecords(year: number): Promise<MonthlyTaxRecord[]> {
  const { data, error } = await supabaseClient
    .from('monthly_tax_records')
    .select('*')
    .eq('tax_year', year)
    .order('tax_month', { ascending: true });

  if (error) throw new Error('TAX_RECORDS: ' + error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map(toMonthlyTaxRecord);
}

export async function saveMonthlyTaxRecord(input: SaveMonthlyTaxRecordInput): Promise<void> {
  const { userId, orgId } = await getCurrentProfileContext();

  const { error } = await supabaseClient.from('monthly_tax_records').upsert(
    {
      org_id: orgId,
      tax_year: input.taxYear,
      tax_month: input.taxMonth,
      crm_revenue: input.crmRevenue,
      revenue_adjustment: input.revenueAdjustment,
      salary_expense: input.salaryExpense,
      rent_expense: input.rentExpense,
      other_expense: input.otherExpense,
      inventory_cost: input.inventoryCost,
      taxable_profit: input.taxableProfit,
      cumulative_taxable_profit: input.cumulativeTaxableProfit,
      estimated_tax: input.estimatedTax,
      notes: input.notes,
      created_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id,tax_year,tax_month' },
  );

  if (error) throw new Error('TAX_SAVE: ' + error.message);
}

export function useIncomeTaxBrackets(year: number) {
  return useQuery({
    queryKey: INCOME_TAX_BRACKETS_QUERY_KEY(year),
    queryFn: () => fetchIncomeTaxBrackets(year),
  });
}

export function useMonthlyTaxRecords(year: number) {
  return useQuery({
    queryKey: MONTHLY_TAX_QUERY_KEY(year),
    queryFn: () => fetchMonthlyTaxRecords(year),
  });
}

export function useSaveMonthlyTaxRecordMutation(year: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveMonthlyTaxRecord,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MONTHLY_TAX_QUERY_KEY(year) });
    },
  });
}
