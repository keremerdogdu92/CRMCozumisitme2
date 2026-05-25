// src/features/finance/SupplierPayablesCard.tsx

import { useMemo, useState } from 'react';
import {
  useCreateSupplierLedgerEntryMutation,
  useCreateSupplierMutation,
  useSaveSupplierMappingMutation,
  useSupplierLedger,
  useSupplierMappings,
  useSuppliers,
} from './supplierApi';

const ENTRY_TYPES = [
  { value: 'manual_debt', label: 'Borc ekle' },
  { value: 'payment', label: 'Odeme / borc dus' },
  { value: 'adjustment', label: 'Duzeltme' },
] as const;

const PAYMENT_METHODS = ['Tim', 'Sivantos'] as const;

function parseMoney(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function SupplierPayablesCard() {
  const { data: suppliers } = useSuppliers();
  const { data: ledger } = useSupplierLedger();
  const { data: mappings } = useSupplierMappings();
  const createSupplierMutation = useCreateSupplierMutation();
  const createEntryMutation = useCreateSupplierLedgerEntryMutation();
  const saveMappingMutation = useSaveSupplierMappingMutation();

  const [supplierName, setSupplierName] = useState('');
  const [entrySupplierId, setEntrySupplierId] = useState('');
  const [entryType, setEntryType] = useState('manual_debt');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [mappingSupplierId, setMappingSupplierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Tim');

  const balances = useMemo(() => {
    const map = new Map<string, number>();
    (suppliers ?? []).forEach((supplier) => map.set(supplier.id, 0));
    (ledger ?? []).forEach((entry) => {
      map.set(entry.supplier_id, (map.get(entry.supplier_id) ?? 0) + entry.amount);
    });
    return map;
  }, [ledger, suppliers]);

  const supplierNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (suppliers ?? []).forEach((supplier) => map.set(supplier.id, supplier.name));
    return map;
  }, [suppliers]);

  function handleCreateSupplier() {
    createSupplierMutation.mutate(supplierName, {
      onSuccess: () => setSupplierName(''),
    });
  }

  function handleCreateEntry() {
    const rawAmount = parseMoney(entryAmount);
    const signedAmount =
      entryType === 'payment' ? -Math.abs(rawAmount) : rawAmount;

    createEntryMutation.mutate(
      {
        supplierId: entrySupplierId,
        entryType,
        amount: signedAmount,
        occurredAt: entryDate,
        description: entryDescription.trim() || null,
      },
      {
        onSuccess: () => {
          setEntryAmount('');
          setEntryDescription('');
        },
      },
    );
  }

  function handleSaveMapping() {
    saveMappingMutation.mutate({
      supplierId: mappingSupplierId,
      paymentMethod,
    });
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-xs font-semibold text-slate-900">Tedarikci borc defteri</h3>
        <p className="mt-1 text-[11px] text-slate-500">
          Toptanci borclari, manuel kayitlar ve Tim/Sivantos hasta tahsilat
          eslemeleriyle takip edilir.
        </p>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-md bg-slate-50 p-3">
          <h4 className="text-xs font-semibold text-slate-800">Tedarikci ekle</h4>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Orn: Sivantos"
            />
            <button
              type="button"
              onClick={handleCreateSupplier}
              disabled={createSupplierMutation.isPending}
              className="rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              Ekle
            </button>
          </div>
        </div>

        <div className="rounded-md bg-slate-50 p-3 lg:col-span-2">
          <h4 className="text-xs font-semibold text-slate-800">Odeme yontemi esle</h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            <select
              value={mappingSupplierId}
              onChange={(event) => setMappingSupplierId(event.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Tedarikci sec</option>
              {(suppliers ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSaveMapping}
              disabled={saveMappingMutation.isPending}
              className="rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-60"
            >
              Eslemeyi kaydet
            </button>
          </div>
          {mappings && mappings.length > 0 && (
            <p className="mt-2 text-[11px] text-slate-500">
              Aktif eslemeler:{' '}
              {mappings
                .map((mapping) => `${mapping.payment_method} -> ${supplierNameMap.get(mapping.supplier_id) ?? '-'}`)
                .join(', ')}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-md border border-slate-200 p-3">
          <h4 className="text-xs font-semibold text-slate-800">Bakiye</h4>
          <div className="mt-2 space-y-2 text-xs">
            {(suppliers ?? []).length === 0 && (
              <p className="text-slate-500">Henuz tedarikci yok.</p>
            )}
            {(suppliers ?? []).map((supplier) => {
              const balance = balances.get(supplier.id) ?? 0;
              return (
                <div
                  key={supplier.id}
                  className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
                >
                  <span className="font-medium text-slate-800">{supplier.name}</span>
                  <span className={balance >= 0 ? 'text-red-700' : 'text-emerald-700'}>
                    {formatMoney(balance)} TL
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <h4 className="text-xs font-semibold text-slate-800">Manuel hareket</h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <select
              value={entrySupplierId}
              onChange={(event) => setEntrySupplierId(event.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Tedarikci sec</option>
              {(suppliers ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <select
              value={entryType}
              onChange={(event) => setEntryType(event.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {ENTRY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={entryAmount}
              onChange={(event) => setEntryAmount(event.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Tutar"
            />
            <input
              type="date"
              value={entryDate}
              onChange={(event) => setEntryDate(event.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <input
              type="text"
              value={entryDescription}
              onChange={(event) => setEntryDescription(event.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm sm:col-span-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Aciklama"
            />
            <button
              type="button"
              onClick={handleCreateEntry}
              disabled={createEntryMutation.isPending}
              className="rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-60 sm:col-span-2"
            >
              Hareket ekle
            </button>
          </div>
        </div>
      </div>

      {(createSupplierMutation.error ||
        createEntryMutation.error ||
        saveMappingMutation.error) && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {(
            createSupplierMutation.error ||
            createEntryMutation.error ||
            saveMappingMutation.error
          ) instanceof Error
            ? (
                createSupplierMutation.error ||
                createEntryMutation.error ||
                saveMappingMutation.error
              )?.message
            : 'Islem sirasinda hata olustu.'}
        </p>
      )}
    </section>
  );
}
