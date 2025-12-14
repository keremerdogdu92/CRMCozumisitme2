// src/features/patients/components/detail/PatientDetailBatteryPrescriptionsTab.tsx
// Summary: Patient detail tab for battery prescription deliveries (SGK reimbursement events).
// Includes: listing + inline "New Delivery" form.
//
// Patch v2.2:
// - FIX (critical): Aligns UI + create flow with DB schema (qty_boxes/qty_packs/qty_units, delivered_at, prescription_no, sgk_expected_amount).
// - FIX (critical): Removes dependency on non-existent/incorrect hooks module (api.batteryPrescriptions).
// - Adds React Query usage locally (query + mutation) using api.batteryPrescriptionDeliveries helpers.
// - Loads org_id via useCurrentProfile to satisfy RLS (org_id required for insert).
// - Keeps listing resilient to snake_case vs camelCase response shapes.
// - Actionable errors; no hard dependency on meetings.
//
// Notes:
// - This tab is intentionally not tied to meetings or meeting_accessories.
// - For "walk-in battery sales" without patient identity: handle via stock adjustment only (separate flow).

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentProfile } from '../../../auth/useCurrentProfile';
import type { BatteryLineDraft, BatteryPrescriptionDeliveryRow } from '../../types';
import {
  createBatteryPrescriptionDeliveries,
  fetchBatteryPrescriptionDeliveriesByPatient,
} from '../../api/api.batteryPrescriptionDeliveries';
import { formatDateTime } from '../../patientFormatUtils';

type PatientDetailBatteryPrescriptionsTabProps = {
  patientId: string;
  open: boolean;
};

type FormState = {
  deliveredAt: string; // local datetime input value (YYYY-MM-DDTHH:mm)
  prescriptionNo: string;
  batteryType: string;
  qtyBoxes: string;
  qtyPacks: string;
  qtyUnits: string;
  sgkExpectedAmount: string;
  note: string;
};

const DELIVERIES_QUERY_KEY = (patientId: string) =>
  ['battery-prescription-deliveries', patientId] as const;

function toLocalDateTimeInputValue(d: Date): string {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function safeTrim(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.floor(n);
}

function parseOptionalMoney(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const normalized = t.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Number(n.toFixed(2));
}

function formatMoney(amount: number | null): string {
  if (amount == null || Number.isNaN(amount)) return '-';
  try {
    return amount.toLocaleString('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${amount}`;
  }
}

function qtyTotal(line: BatteryLineDraft): number {
  const q = line.quantity ?? { box: 0, pack: 0, unit: 0 };
  const box = Number.isFinite(q.box) ? q.box : 0;
  const pack = Number.isFinite(q.pack) ? q.pack : 0;
  const unit = Number.isFinite(q.unit) ? q.unit : 0;
  return box + pack + unit;
}

type DeliveryRowView = {
  id: string;
  deliveredAt: string | null;
  batteryType: string;
  qtyBoxes: number | null;
  qtyPacks: number | null;
  qtyUnits: number | null;
  prescriptionNo: string | null;
  sgkExpectedAmount: number | null;
  note: string | null;
};

function toDeliveryRowView(r: BatteryPrescriptionDeliveryRow): DeliveryRowView {
  // Keep resilient against snake_case vs camelCase.
  const anyRow = r as any;

  const id = String(anyRow.id ?? '');
  const deliveredAt = (anyRow.delivered_at ?? anyRow.deliveredAt ?? null) as string | null;
  const batteryType = String(anyRow.battery_type ?? anyRow.batteryType ?? '');
  const qtyBoxes = (anyRow.qty_boxes ?? anyRow.qtyBoxes ?? null) as number | null;
  const qtyPacks = (anyRow.qty_packs ?? anyRow.qtyPacks ?? null) as number | null;
  const qtyUnits = (anyRow.qty_units ?? anyRow.qtyUnits ?? null) as number | null;
  const prescriptionNo = (anyRow.prescription_no ?? anyRow.prescriptionNo ?? null) as string | null;
  const sgkExpectedAmount = (anyRow.sgk_expected_amount ?? anyRow.sgkExpectedAmount ?? null) as number | null;
  const note = (anyRow.note ?? null) as string | null;

  return {
    id,
    deliveredAt,
    batteryType,
    qtyBoxes,
    qtyPacks,
    qtyUnits,
    prescriptionNo,
    sgkExpectedAmount,
    note,
  };
}

export function PatientDetailBatteryPrescriptionsTab({
  patientId,
  open,
}: PatientDetailBatteryPrescriptionsTabProps) {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();

  const [showNewForm, setShowNewForm] = useState(false);

  const initialForm: FormState = useMemo(() => {
    return {
      deliveredAt: toLocalDateTimeInputValue(new Date()),
      prescriptionNo: '',
      batteryType: '312',
      qtyBoxes: '',
      qtyPacks: '',
      qtyUnits: '',
      sgkExpectedAmount: '',
      note: '',
    };
  }, []);

  const [form, setForm] = useState<FormState>(initialForm);
  const [localError, setLocalError] = useState<string>('');

  const deliveriesQuery = useQuery({
    queryKey: open ? DELIVERIES_QUERY_KEY(patientId) : ['battery-prescription-deliveries', 'closed'],
    enabled: open && !!patientId,
    queryFn: async () => {
      return await fetchBatteryPrescriptionDeliveriesByPatient(patientId);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const orgId = (profile as any)?.org_id as string | undefined;
      if (!orgId) {
        throw new Error('ORG_ID_MISSING: Profil org_id bulunamadı. Lütfen tekrar giriş yapın.');
      }

      const dt = form.deliveredAt.trim();
      if (!dt) {
        throw new Error('Teslim tarihi boş olamaz.');
      }

      const deliveredAtIso = new Date(dt).toISOString();
      if (!deliveredAtIso || deliveredAtIso === 'Invalid Date') {
        throw new Error('Teslim tarihi geçersiz. Lütfen tekrar seçin.');
      }

      const batteryType = form.batteryType.trim();
      if (!batteryType) {
        throw new Error('Pil tipi boş olamaz.');
      }

      const qtyBoxesParsed = parseOptionalInt(form.qtyBoxes);
      if (Number.isNaN(qtyBoxesParsed)) {
        throw new Error('Kutu alanı sayı olmalı ve 0 veya daha büyük olmalı.');
      }

      const qtyPacksParsed = parseOptionalInt(form.qtyPacks);
      if (Number.isNaN(qtyPacksParsed)) {
        throw new Error('Paket alanı sayı olmalı ve 0 veya daha büyük olmalı.');
      }

      const qtyUnitsParsed = parseOptionalInt(form.qtyUnits);
      if (Number.isNaN(qtyUnitsParsed)) {
        throw new Error('Adet alanı sayı olmalı ve 0 veya daha büyük olmalı.');
      }

      const hasAnyQty =
        (qtyBoxesParsed != null && qtyBoxesParsed > 0) ||
        (qtyPacksParsed != null && qtyPacksParsed > 0) ||
        (qtyUnitsParsed != null && qtyUnitsParsed > 0);

      if (!hasAnyQty) {
        throw new Error('En az bir miktar girin (kutu / paket / adet).');
      }

      const expectedAmountParsed = parseOptionalMoney(form.sgkExpectedAmount);
      if (Number.isNaN(expectedAmountParsed)) {
        throw new Error('Beklenen SGK tutarı geçersiz. Örnek: 250 veya 250,50');
      }

      const line: BatteryLineDraft = {
        batteryType,
        brand: '',
        quantity: {
          box: qtyBoxesParsed ?? 0,
          pack: qtyPacksParsed ?? 0,
          unit: qtyUnitsParsed ?? 0,
        },
      };

      if (qtyTotal(line) <= 0) {
        throw new Error('En az bir miktar girin (kutu / paket / adet).');
      }

      await createBatteryPrescriptionDeliveries({
        orgId,
        input: {
          patientId,
          deliveredAt: deliveredAtIso,
          prescriptionNo: safeTrim(form.prescriptionNo) || null,
          note: safeTrim(form.note) || null,
          sgkExpectedAmount: expectedAmountParsed,
          lines: [line],
        } as any,
      });
    },
    onSuccess: async () => {
      setShowNewForm(false);
      setForm(initialForm);
      await queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY(patientId) });
    },
  });

  if (!open) return null;

  const deliveries = (deliveriesQuery.data ?? []).map(toDeliveryRowView);

  const handleToggleNew = () => {
    setLocalError('');
    setShowNewForm((p) => !p);
    if (!showNewForm) {
      setForm(initialForm);
    }
  };

  const handleSubmit = () => {
    setLocalError('');
    createMutation.mutate(undefined, {
      onError: (e) => {
        const msg = e instanceof Error ? e.message : 'Teslimat kaydedilirken beklenmeyen bir hata oluştu.';
        setLocalError(msg);
      },
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase text-slate-500">Pil Teslimleri</h4>

        <button
          type="button"
          onClick={handleToggleNew}
          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {showNewForm ? 'Formu Kapat' : 'Yeni Teslimat'}
        </button>
      </div>

      {showNewForm && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-[11px] font-medium text-slate-600">Teslim Tarihi</span>
              <input
                type="datetime-local"
                value={form.deliveredAt}
                onChange={(e) => setForm((p) => ({ ...p, deliveredAt: e.target.value }))}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>

            <label className="space-y-1">
              <span className="block text-[11px] font-medium text-slate-600">Reçete No (opsiyonel)</span>
              <input
                type="text"
                value={form.prescriptionNo}
                onChange={(e) => setForm((p) => ({ ...p, prescriptionNo: e.target.value }))}
                placeholder="Örn: 2025-..."
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>

            <label className="space-y-1">
              <span className="block text-[11px] font-medium text-slate-600">Pil Tipi</span>
              <select
                value={form.batteryType}
                onChange={(e) => setForm((p) => ({ ...p, batteryType: e.target.value }))}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="10">10</option>
                <option value="312">312</option>
                <option value="13">13</option>
                <option value="675">675</option>
              </select>
            </label>

            <div className="grid grid-cols-3 gap-2 sm:col-span-1">
              <label className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-600">Kutu</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.qtyBoxes}
                  onChange={(e) => setForm((p) => ({ ...p, qtyBoxes: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </label>

              <label className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-600">Paket</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.qtyPacks}
                  onChange={(e) => setForm((p) => ({ ...p, qtyPacks: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </label>

              <label className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-600">Adet</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.qtyUnits}
                  onChange={(e) => setForm((p) => ({ ...p, qtyUnits: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </label>
            </div>

            <label className="space-y-1 sm:col-span-2">
              <span className="block text-[11px] font-medium text-slate-600">
                Beklenen SGK Tutarı (TRY) (opsiyonel)
              </span>
              <input
                type="text"
                value={form.sgkExpectedAmount}
                onChange={(e) => setForm((p) => ({ ...p, sgkExpectedAmount: e.target.value }))}
                placeholder="Örn: 250 veya 250,50"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>

            <label className="space-y-1 sm:col-span-2">
              <span className="block text-[11px] font-medium text-slate-600">Not (opsiyonel)</span>
              <textarea
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                rows={3}
                placeholder="Örn: 1 yıllık pil teslim edildi."
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
          </div>

          {localError && <p className="text-[11px] font-medium text-red-600">{localError}</p>}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleToggleNew}
              className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="inline-flex items-center rounded-md bg-primary-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {deliveriesQuery.isLoading && <p className="text-xs text-slate-500">Teslimatlar yükleniyor...</p>}

      {deliveriesQuery.isError && (
        <p className="text-xs text-red-600">
          Pil teslimatları alınırken bir hata oluştu:{' '}
          {(deliveriesQuery.error as Error)?.message ?? 'Bilinmeyen hata'}
        </p>
      )}

      {!deliveriesQuery.isLoading && !deliveriesQuery.isError && deliveries.length === 0 && (
        <p className="text-xs text-slate-500">Bu hasta için henüz pil teslimatı kaydı yok.</p>
      )}

      {!deliveriesQuery.isLoading && !deliveriesQuery.isError && deliveries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Tarih</th>
                <th className="px-3 py-2 font-medium">Pil</th>
                <th className="px-3 py-2 font-medium">Kutu</th>
                <th className="px-3 py-2 font-medium">Paket</th>
                <th className="px-3 py-2 font-medium">Adet</th>
                <th className="px-3 py-2 font-medium">Reçete No</th>
                <th className="px-3 py-2 font-medium">Beklenen SGK</th>
                <th className="px-3 py-2 font-medium">Not</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-800">{formatDateTime(row.deliveredAt)}</td>
                  <td className="px-3 py-2 text-slate-800">{row.batteryType}</td>
                  <td className="px-3 py-2 text-slate-800">{row.qtyBoxes != null ? row.qtyBoxes : '-'}</td>
                  <td className="px-3 py-2 text-slate-800">{row.qtyPacks != null ? row.qtyPacks : '-'}</td>
                  <td className="px-3 py-2 text-slate-800">{row.qtyUnits != null ? row.qtyUnits : '-'}</td>
                  <td className="px-3 py-2 text-slate-800">{row.prescriptionNo ?? '-'}</td>
                  <td className="px-3 py-2 text-slate-800">{formatMoney(row.sgkExpectedAmount)}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {row.note ? row.note.slice(0, 140) : '-'}
                    {row.note && row.note.length > 140 ? '…' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
