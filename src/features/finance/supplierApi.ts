// src/features/finance/supplierApi.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';

export type SupplierRow = {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
};

export type SupplierLedgerEntry = {
  id: string;
  supplier_id: string;
  entry_type: string;
  amount: number;
  occurred_at: string;
  description: string | null;
  meeting_payment_id: string | null;
};

export type SupplierPaymentMethodMapping = {
  id: string;
  supplier_id: string;
  payment_method: string;
};

export const SUPPLIERS_QUERY_KEY = ['suppliers'] as const;
export const SUPPLIER_LEDGER_QUERY_KEY = ['supplier-ledger'] as const;
export const SUPPLIER_MAPPINGS_QUERY_KEY = ['supplier-payment-method-mappings'] as const;

async function getCurrentOrgId(): Promise<string> {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw new Error('SUPPLIER_USER: ' + userError.message);
  const user = userData.user;
  if (!user) throw new Error('SUPPLIER_USER: Kullanici oturumu bulunamadi.');

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (error) throw new Error('SUPPLIER_PROFILE: ' + error.message);
  if (!data?.org_id) throw new Error('SUPPLIER_NO_ORG: Profilde org_id bulunamadi.');
  return data.org_id as string;
}

export async function fetchSuppliers(): Promise<SupplierRow[]> {
  const { data, error } = await supabaseClient
    .from('suppliers')
    .select('id, org_id, name, is_active')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) throw new Error('SUPPLIERS_FETCH: ' + error.message);
  return (data ?? []) as SupplierRow[];
}

export async function fetchSupplierLedger(): Promise<SupplierLedgerEntry[]> {
  const { data, error } = await supabaseClient
    .from('supplier_ledger_entries')
    .select('id, supplier_id, entry_type, amount, occurred_at, description, meeting_payment_id')
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false });

  if (error) throw new Error('SUPPLIER_LEDGER_FETCH: ' + error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    supplier_id: String(row.supplier_id),
    entry_type: String(row.entry_type),
    amount: Number(row.amount ?? 0),
    occurred_at: String(row.occurred_at),
    description: (row.description as string | null) ?? null,
    meeting_payment_id: (row.meeting_payment_id as string | null) ?? null,
  }));
}

export async function fetchSupplierMappings(): Promise<SupplierPaymentMethodMapping[]> {
  const { data, error } = await supabaseClient
    .from('supplier_payment_method_mappings')
    .select('id, supplier_id, payment_method')
    .order('payment_method', { ascending: true });

  if (error) throw new Error('SUPPLIER_MAPPINGS_FETCH: ' + error.message);
  return (data ?? []) as SupplierPaymentMethodMapping[];
}

export async function createSupplier(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tedarikci adi zorunludur.');
  const orgId = await getCurrentOrgId();

  const { error } = await supabaseClient.from('suppliers').insert({
    org_id: orgId,
    name: trimmed,
  });

  if (error) throw new Error('SUPPLIER_CREATE: ' + error.message);
}

export async function createSupplierLedgerEntry(input: {
  supplierId: string;
  entryType: string;
  amount: number;
  occurredAt: string;
  description: string | null;
}): Promise<void> {
  if (!input.supplierId) throw new Error('Tedarikci secin.');
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    throw new Error('Gecerli bir tutar girin.');
  }
  const orgId = await getCurrentOrgId();

  const { error } = await supabaseClient.from('supplier_ledger_entries').insert({
    org_id: orgId,
    supplier_id: input.supplierId,
    entry_type: input.entryType,
    amount: input.amount,
    occurred_at: input.occurredAt
      ? new Date(`${input.occurredAt}T12:00:00+03:00`).toISOString()
      : new Date().toISOString(),
    description: input.description,
  });

  if (error) throw new Error('SUPPLIER_LEDGER_CREATE: ' + error.message);
}

export async function saveSupplierMapping(input: {
  supplierId: string;
  paymentMethod: string;
}): Promise<void> {
  if (!input.supplierId) throw new Error('Tedarikci secin.');
  if (!input.paymentMethod) throw new Error('Odeme yontemi secin.');
  const orgId = await getCurrentOrgId();

  const { error } = await supabaseClient.from('supplier_payment_method_mappings').upsert(
    {
      org_id: orgId,
      supplier_id: input.supplierId,
      payment_method: input.paymentMethod,
    },
    { onConflict: 'org_id,payment_method' },
  );

  if (error) throw new Error('SUPPLIER_MAPPING_SAVE: ' + error.message);
}

export function useSuppliers() {
  return useQuery({ queryKey: SUPPLIERS_QUERY_KEY, queryFn: fetchSuppliers });
}

export function useSupplierLedger() {
  return useQuery({ queryKey: SUPPLIER_LEDGER_QUERY_KEY, queryFn: fetchSupplierLedger });
}

export function useSupplierMappings() {
  return useQuery({ queryKey: SUPPLIER_MAPPINGS_QUERY_KEY, queryFn: fetchSupplierMappings });
}

export function useCreateSupplierMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY });
    },
  });
}

export function useCreateSupplierLedgerEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSupplierLedgerEntry,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUPPLIER_LEDGER_QUERY_KEY });
    },
  });
}

export function useSaveSupplierMappingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveSupplierMapping,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUPPLIER_MAPPINGS_QUERY_KEY });
    },
  });
}
