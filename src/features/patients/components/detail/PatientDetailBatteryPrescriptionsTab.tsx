// src/features/patients/components/detail/PatientDetailBatteryPrescriptionsTab.tsx
// Summary: Patient detail tab for battery prescription deliveries (SGK reimbursement events).
// Includes: listing + inline "New Delivery" form.
// Notes:
// - This is intentionally not tied to meetings or meeting_accessories.
// - For "walk-in battery sales" without patient identity: handle via stock adjustment only (separate flow).

import { useMemo, useState } from 'react';
import {
  useCreateBatteryPrescriptionDeliveryMutation,
  usePatientBatteryPrescriptionDeliveries,
  type BatteryPrescriptionDeliveryRow,
} from '../../api/api.batteryPrescriptions';
import { formatDateTime } from '../../patientFormatUtils';

type PatientDetailBatteryPrescriptionsTabProps = {
  patientId: string;
  open: boolean;
};

type FormState = {
  deliveredAt: string; // local datetime input value (YYYY-MM-DDTHH:mm)
  prescriptionNo: string;
  batteryType: string;
  qtyUnits: string;
  sgkExpectedAmount: string;
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

function parseOptionalMoney(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const normalized = t.replace(/\s/g, '').replace(',', '.');
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
      qtyUnits: '',
      sgkExpectedAmount: '',
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

    const batteryType = form.batteryType.trim();
    if (!batteryType) {
      setLocalError('Pil tipi boş olamaz.');
      return;
    }

    const qtyUnitsParsed = parseOptionalInt(form.qtyUnits);
    if (Number.isNaN(qtyUnitsParsed)) {
      setLocalError('Adet alanı sayı olmalı ve 0 veya daha büyük olmalı.');
      return;
    }

    const expectedAmountParsed = parseOptionalMoney(form.sgkExpectedAmount);
    if (Number.isNaN(expectedAmountParsed)) {
      setLocalError(
        'Beklenen SGK tutarı geçersiz. Örnek: 250 veya 250,50',
      );
      return;
    }

    // Require at least one meaningful field (qty or expected amount)
    const hasAnyValue =
      (qtyUnitsParsed != null && qtyUnitsParsed > 0) ||
      (expectedAmountParsed != null && expectedAmountParsed > 0) ||
      form.prescriptionNo.trim().length > 0 ||
      form.note.trim().length > 0;

    if (!hasAnyValue) {
      setLocalError(
        'En az bir alan doldurun (adet / beklenen tutar / reçete no / not).',
      );
      return;
    }

    createMutation.mutate(
      {
        patientId,
        deliveredAtIso,
        prescriptionNo: form.prescriptionNo,
        batteryType,
        qtyUnits: qtyUnitsParsed,
        sgkExpectedAmount: expectedAmountParsed,
        note: form.note,
      },
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

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase text-slate-500">
          Pil Reçeteleri
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

            <label className="space-y-1">
              <span className="block text-[11px] font-medium text-slate-600">
                Adet (opsiyonel)
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={form.qtyUnits}
                onChange={(e) =>
                  setForm((p) => ({ ...p, qtyUnits: e.target.value }))
                }
                placeholder="Örn: 60"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>

            <label className="space-y-1 sm:col-span-2">
              <span className="block text-[11px] font-medium text-slate-600">
                Beklenen SGK Tutarı (TRY) (opsiyonel)
              </span>
              <input
                type="text"
                value={form.sgkExpectedAmount}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    sgkExpectedAmount: e.target.value,
                  }))
                }
                placeholder="Örn: 250 veya 250,50"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>

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

      {!isLoading && !isError && deliveries.length === 0 && (
        <p className="text-xs text-slate-500">
          Bu hasta için henüz pil reçetesi teslimatı kaydı yok.
        </p>
      )}

      {!isLoading && !isError && deliveries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Tarih</th>
                <th className="px-3 py-2 font-medium">Pil</th>
                <th className="px-3 py-2 font-medium">Adet</th>
                <th className="px-3 py-2 font-medium">Reçete No</th>
                <th className="px-3 py-2 font-medium">Beklenen SGK</th>
                <th className="px-3 py-2 font-medium">Not</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((row: BatteryPrescriptionDeliveryRow) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-800">
                    {formatDateTime(row.deliveredAt)}
                  </td>
                  <td className="px-3 py-2 text-slate-800">{row.batteryType}</td>
                  <td className="px-3 py-2 text-slate-800">
                    {row.qtyUnits != null ? row.qtyUnits : '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    {row.prescriptionNo ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    {formatMoney(row.sgkExpectedAmount)}
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
