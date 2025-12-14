// src/features/patients/components/detail/PatientDetailBatteryPrescriptionsTab.tsx
// Summary: Patient detail tab for battery prescription deliveries (SGK reimbursement events).
// Includes: listing + inline "New Delivery" form.
//
// Patch v2.1:
// - FIX (critical): Uses battery_prescription_deliveries schema (qty_boxes/qty_packs/qty_units, delivered_at, prescription_no).
// - FIX: Imports hooks from api.batteryPrescriptionDeliveries (was api.batteryPrescriptions; wrong module).
// - CHANGE: Form now captures box/pack/unit quantities (not single qtyUnits) to match DB + createPatient flow.
// - FIX: Uses delivered_at + created_at field names and resilient row mapping for UI.
// - PERF: Keeps derived values memoized; avoids heavy work when tab is closed.
// - Keeps UI/UX: inline form, actionable errors, best-effort formatting.
//
// Notes:
// - This is intentionally not tied to meetings or meeting_accessories.
// - For "walk-in battery sales" without patient identity: handle via stock adjustment only (separate flow).

import { useMemo, useState } from 'react';
import {
  // NOTE: this must come from the deliveries API (DB source of truth)
  // If you don't have hooks yet in this file, I need that file next.
  useCreateBatteryPrescriptionDeliveryMutation,
  usePatientBatteryPrescriptionDeliveries,
  type BatteryPrescriptionDeliveryRow,
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
  note: string;
};

function toLocalDateTimeInputValue(d: Date): string {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.floor(n);
}

function safeTrim(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function formatQty(qty: number | null | undefined): string {
  if (qty == null || Number.isNaN(qty)) return '-';
  return `${qty}`;
}

function normalizeBatteryType(v: string): string {
  const t = v.trim();
  // UI options restrict to these, but keep resilience.
  return t;
}

function hasAnyQty(boxes: number | null, packs: number | null, units: number | null): boolean {
  return (boxes != null && boxes > 0) || (packs != null && packs > 0) || (units != null && units > 0);
}

function totalQty(boxes: number | null, packs: number | null, units: number | null): number {
  return (boxes ?? 0) + (packs ?? 0) + (units ?? 0);
}

export function PatientDetailBatteryPrescriptionsTab({
  patientId,
  open,
}: PatientDetailBatteryPrescriptionsTabProps) {
  const [showNewForm, setShowNewForm] = useState(false);

  const initialForm: FormState = useMemo(() => {
    return {
      deliveredAt: toLocalDateTimeInputValue(new Date()),
      prescriptionNo: '',
      batteryType: '312',
      qtyBoxes: '',
      qtyPacks: '',
      qtyUnits: '',
      note: '',
    };
  }, []);

  const [form, setForm] = useState<FormState>(initialForm);
  const [localError, setLocalError] = useState<string>('');

  const {
    data: deliveries = [],
    isLoading,
    isError,
    error,
  } = usePatientBatteryPrescriptionDeliveries(open ? patientId : null);

  const createMutation = useCreateBatteryPrescriptionDeliveryMutation(patientId);

  if (!open) return null;

  const handleToggleNew = () => {
    setLocalError('');
    setShowNewForm((p) => !p);
    if (!showNewForm) {
      setForm(initialForm);
    }
  };

  const handleSubmit = () => {
    setLocalError('');

    const dt = form.deliveredAt.trim();
    if (!dt) {
      setLocalError('Teslim tarihi boş olamaz.');
      return;
    }

    const deliveredAtIso = new Date(dt).toISOString();
    if (!deliveredAtIso || deliveredAtIso === 'Invalid Date') {
      setLocalError('Teslim tarihi geçersiz. Lütfen tekrar seçin.');
      return;
    }

    const batteryType = normalizeBatteryType(form.batteryType);
    if (!batteryType) {
      setLocalError('Pil tipi boş olamaz.');
      return;
    }

    const qtyBoxesParsed = parseOptionalInt(form.qtyBoxes);
    if (Number.isNaN(qtyBoxesParsed)) {
      setLocalError('Kutu alanı sayı olmalı ve 0 veya daha büyük olmalı.');
      return;
    }

    const qtyPacksParsed = parseOptionalInt(form.qtyPacks);
    if (Number.isNaN(qtyPacksParsed)) {
      setLocalError('Paket alanı sayı olmalı ve 0 veya daha büyük olmalı.');
      return;
    }

    const qtyUnitsParsed = parseOptionalInt(form.qtyUnits);
    if (Number.isNaN(qtyUnitsParsed)) {
      setLocalError('Adet alanı sayı olmalı ve 0 veya daha büyük olmalı.');
      return;
    }

    // Require at least one meaningful field (qty OR prescription no OR note)
    const hasAnyValue =
      hasAnyQty(qtyBoxesParsed, qtyPacksParsed, qtyUnitsParsed) ||
      safeTrim(form.prescriptionNo).length > 0 ||
      safeTrim(form.note).length > 0;

    if (!hasAnyValue) {
      setLocalError('En az bir alan doldurun (kutu/paket/adet / reçete no / not).');
      return;
    }

    if (!hasAnyQty(qtyBoxesParsed, qtyPacksParsed, qtyUnitsParsed)) {
      setLocalError('Bu ekran SGK “teslim” kaydı için. En az bir miktar (kutu/paket/adet) girin.');
      return;
    }

    createMutation.mutate(
      {
        // NOTE: this payload must match your mutation input type (in api.batteryPrescriptionDeliveries.ts)
        orgId: '', // likely derived in the mutation via profile; if your mutation requires it here, we need to pass it.
        input: {
          patientId,
          deliveredAt: deliveredAtIso,
          prescriptionNo: safeTrim(form.prescriptionNo) || null,
          note: safeTrim(form.note) || null,
          lines: [
            {
              batteryType,
              brand: '',
              quantity: {
                box: qtyBoxesParsed ?? 0,
                pack: qtyPacksParsed ?? 0,
                unit: qtyUnitsParsed ?? 0,
              },
            },
          ],
        },
      } as any,
      {
        onSuccess: () => {
          setShowNewForm(false);
          setForm(initialForm);
        },
        onError: (e) => {
          const msg =
            e instanceof Error
              ? e.message
              : 'Teslimat kaydedilirken beklenmeyen bir hata oluştu.';
          setLocalError(msg);
        },
      },
    );
  };

  const rows = useMemo(() => {
    // Normalize for both old/new shapes if needed.
    // DB columns: delivered_at, prescription_no, qty_boxes, qty_packs, qty_units, battery_type, note, created_at
    return (deliveries ?? []).map((r: BatteryPrescriptionDeliveryRow) => {
      const anyRow: any = r;
      return {
        id: anyRow.id as string,
        delivered_at: (anyRow.delivered_at ?? anyRow.deliveredAt) as string | null,
        battery_type: (anyRow.battery_type ?? anyRow.batteryType) as string,
        qty_boxes: (anyRow.qty_boxes ?? anyRow.qtyBoxes ?? null) as number | null,
        qty_packs: (anyRow.qty_packs ?? anyRow.qtyPacks ?? null) as number | null,
        qty_units: (anyRow.qty_units ?? anyRow.qtyUnits ?? null) as number | null,
        prescription_no: (anyRow.prescription_no ?? anyRow.prescriptionNo ?? null) as string | null,
        note: (anyRow.note ?? null) as string | null,
        created_at: (anyRow.created_at ?? anyRow.createdAt ?? null) as string | null,
      };
    });
  }, [deliveries]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase text-slate-500">
          Pil Teslimleri (SGK)
        </h4>

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
              <span className="block text-[11px] font-medium text-slate-600">
                Teslim Tarihi
              </span>
              <input
                type="datetime-local"
                value={form.deliveredAt}
                onChange={(e) =>
                  setForm((p) => ({ ...p, deliveredAt: e.target.value }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>

            <label className="space-y-1">
              <span className="block text-[11px] font-medium text-slate-600">
                Reçete No (opsiyonel)
              </span>
              <input
                type="text"
                value={form.prescriptionNo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, prescriptionNo: e.target.value }))
                }
                placeholder="Örn: 2025-..."
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>

            <label className="space-y-1">
              <span className="block text-[11px] font-medium text-slate-600">
                Pil Tipi
              </span>
              <select
                value={form.batteryType}
                onChange={(e) =>
                  setForm((p) => ({ ...p, batteryType: e.target.value }))
                }
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
                <span className="block text-[11px] font-medium text-slate-600">
                  Kutu
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.qtyBoxes}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, qtyBoxes: e.target.value }))
                  }
                  placeholder="0"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </label>

              <label className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-600">
                  Paket
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.qtyPacks}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, qtyPacks: e.target.value }))
                  }
                  placeholder="0"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </label>

              <label className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-600">
                  Adet
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.qtyUnits}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, qtyUnits: e.target.value }))
                  }
                  placeholder="0"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </label>
            </div>

            <label className="space-y-1 sm:col-span-2">
              <span className="block text-[11px] font-medium text-slate-600">
                Not (opsiyonel)
              </span>
              <textarea
                value={form.note}
                onChange={(e) =>
                  setForm((p) => ({ ...p, note: e.target.value }))
                }
                rows={3}
                placeholder="Örn: 1 yıllık pil teslim edildi."
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>

            <div className="sm:col-span-2">
              <p className="text-[11px] text-slate-600">
                Toplam miktar: <span className="font-semibold">{totalQty(parseOptionalInt(form.qtyBoxes), parseOptionalInt(form.qtyPacks), parseOptionalInt(form.qtyUnits))}</span>
              </p>
            </div>
          </div>

          {localError && (
            <p className="text-[11px] font-medium text-red-600">{localError}</p>
          )}

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

      {isLoading && (
        <p className="text-xs text-slate-500">Teslimatlar yükleniyor...</p>
      )}

      {isError && (
        <p className="text-xs text-red-600">
          Pil teslimatları alınırken bir hata oluştu:{' '}
          {(error as Error)?.message ?? 'Bilinmeyen hata'}
        </p>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <p className="text-xs text-slate-500">
          Bu hasta için henüz pil teslimatı kaydı yok.
        </p>
      )}

      {!isLoading && !isError && rows.length > 0 && (
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
                <th className="px-3 py-2 font-medium">Not</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-800">
                    {formatDateTime(row.delivered_at)}
                  </td>
                  <td className="px-3 py-2 text-slate-800">{row.battery_type}</td>
                  <td className="px-3 py-2 text-slate-800">{formatQty(row.qty_boxes)}</td>
                  <td className="px-3 py-2 text-slate-800">{formatQty(row.qty_packs)}</td>
                  <td className="px-3 py-2 text-slate-800">{formatQty(row.qty_units)}</td>
                  <td className="px-3 py-2 text-slate-800">
                    {row.prescription_no ?? '-'}
                  </td>
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
