// src/features/patients/PatientSaleBreakdownCard.tsx
// Reusable card for per-patient sale breakdown (card / cash / company mix).
// Supports both editable (form) and read-only summary variants.

import type {
  UpsertPatientSaleBreakdownItem,
  PatientPaymentMethod,
} from '../../types';
import { formatAmount } from '../../patientFormatUtils';

export type PatientSaleBreakdownCardProps = {
  items: UpsertPatientSaleBreakdownItem[];
  onAddRow: () => void;
  onChangeRow: (
    index: number,
    patch: Partial<UpsertPatientSaleBreakdownItem>,
  ) => void;
  onRemoveRow: (index: number) => void;
  onSave: () => void;
  totalAmount: number;
  isLoading: boolean;
  isSaving: boolean;
  errorMessage: string | null;
  /**
   * When true, the component renders a compact, neutral summary
   * instead of the blue editing UI. Used in patient detail drawer
   * when edit mode is closed.
   */
  readOnly?: boolean;
};

const PAYMENT_METHOD_LABELS: { value: PatientPaymentMethod; label: string }[] =
  [
    { value: 'Kredi_Kartı', label: 'Kredi Kartı' },
    { value: 'Nakit', label: 'Nakit' },
    { value: 'Tim', label: 'Tim (Firma katkısı)' },
    { value: 'Sivantos', label: 'Sivantos (Firma katkısı)' },
    { value: 'Senet', label: 'Senet' },
  ];

function getMethodLabel(method: PatientPaymentMethod): string {
  return (
    PAYMENT_METHOD_LABELS.find((m) => m.value === method)?.label ?? method
  );
}

export function PatientSaleBreakdownCard({
  items,
  onAddRow,
  onChangeRow,
  onRemoveRow,
  onSave,
  totalAmount,
  isLoading,
  isSaving,
  errorMessage,
  readOnly,
}: PatientSaleBreakdownCardProps) {
  const isReadOnly = !!readOnly;

  if (isLoading) {
    return (
      <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
        <p className="text-[11px] text-slate-600">
          Ödeme dağılımı yükleniyor...
        </p>
      </div>
    );
  }

  // READ-ONLY VARIANT ---------------------------------------------------------
  if (isReadOnly) {
    if (items.length === 0) {
      // Detay tabında, hiç satır yoksa kart zaten gösterilmiyor;
      // yine de koruma amaçlı.
      return null;
    }

    // Single payment: show as a very compact box in patient theme style.
    if (items.length === 1) {
      const item = items[0];
      return (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="font-medium text-slate-800">
                Ödeme yöntemi
              </span>
              <span className="text-slate-700">
                {getMethodLabel(item.method)}
              </span>
            </div>
            <div className="text-right">
              <span className="block text-[11px] text-slate-500">
                Tutar
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {formatAmount(
                  Number(
                    (item.amount ?? '0')
                      .replace(/\./g, '')
                      .replace(',', '.'),
                  ),
                )}
              </span>
            </div>
          </div>
          {item.note && (
            <p className="mt-1 text-[11px] text-slate-600">
              Not: {item.note}
            </p>
          )}
        </div>
      );
    }

    // Multiple payments: neutral list box, still compact.
    return (
      <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium text-slate-800">
            Ödeme dağılımı
          </p>
          <p className="text-[11px] text-slate-600">
            Toplam:{' '}
            <span className="font-semibold">
              {formatAmount(totalAmount)}
            </span>
          </p>
        </div>

        <div className="divide-y divide-slate-100 text-[11px]">
          {items.map((item, index) => (
            <div
              key={item.id ?? index}
              className="flex items-start justify-between gap-2 py-1.5"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-baseline gap-1">
                  <span className="font-medium text-slate-800">
                    {getMethodLabel(item.method)}
                  </span>
                  {item.note && (
                    <span className="text-[11px] text-slate-500">
                      — {item.note}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[11px] font-semibold text-slate-900">
                  {formatAmount(
                    Number(
                      (item.amount ?? '0')
                        .replace(/\./g, '')
                        .replace(',', '.'),
                    ),
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // EDITABLE VARIANT ----------------------------------------------------------
  return (
    <div className="space-y-2 rounded-md border border-sky-200 bg-sky-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-sky-900">
            Ödeme dağılımı (Kart / Nakit / Firma)
          </p>
          <p className="text-[11px] text-sky-900">
            Toplam satış tutarını; kredi kartı, nakit ve firma katkıları gibi
            kalemlere bölebilirsin. Bu bilgiler raporlar ve analizler için
            kullanılır.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex shrink-0 items-center rounded-md border border-sky-300 bg-sky-100 px-2 py-1 text-[11px] font-medium text-sky-900 hover:bg-sky-200"
        >
          Satır ekle
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-[11px] text-sky-900">
          Henüz ödeme dağılımı satırı yok. &quot;Satır ekle&quot; ile kart /
          nakit / firma katkısı gibi kalemleri girebilirsin.
        </p>
      )}

      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item, index) => (
            <div
              key={item.id ?? index}
              className="grid gap-2 rounded-md border border-sky-200 bg-white px-2 py-1 text-[11px] sm:grid-cols-12"
            >
              <div className="sm:col-span-3">
                <label className="mb-0.5 block text-[10px] font-medium text-sky-900">
                  Yöntem
                </label>
                <select
                  className="w-full rounded-md border border-sky-300 px-2 py-1 text-[11px] text-slate-900"
                  value={item.method}
                  onChange={(e) =>
                    onChangeRow(index, {
                      method: e.target.value as PatientPaymentMethod,
                    })
                  }
                >
                  {PAYMENT_METHOD_LABELS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="mb-0.5 block text-[10px] font-medium text-sky-900">
                  Tutar
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-sky-300 px-2 py-1 text-[11px]"
                  value={item.amount}
                  onChange={(e) =>
                    onChangeRow(index, { amount: e.target.value })
                  }
                  placeholder="Örn: 20000"
                />
              </div>
              <div className="sm:col-span-5">
                <label className="mb-0.5 block text-[10px] font-medium text-sky-900">
                  Not (opsiyonel)
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-sky-300 px-2 py-1 text-[11px]"
                  value={item.note}
                  onChange={(e) =>
                    onChangeRow(index, { note: e.target.value })
                  }
                  placeholder="Örn: Firma kampanyası, kapora vb."
                />
              </div>
              <div className="flex items-end justify-end sm:col-span-1">
                <button
                  type="button"
                  onClick={() => onRemoveRow(index)}
                  className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] text-sky-900">
          Toplam dağılım:{' '}
          <span className="font-semibold">{formatAmount(totalAmount)}</span>
          <span className="ml-1 text-sky-800">
            (New Patient formundaki &quot;Toplam Satış Tutarı&quot; ile eşit
            olması ideal.)
          </span>
        </div>

        {errorMessage && (
          <p className="text-[11px] text-red-700">{errorMessage}</p>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex items-center rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {isSaving ? 'Dağılım kaydediliyor...' : 'Dağılımı kaydet'}
        </button>
      </div>
    </div>
  );
}
