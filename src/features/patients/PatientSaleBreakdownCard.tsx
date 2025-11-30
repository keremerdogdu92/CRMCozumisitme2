// src/features/patients/PatientSaleBreakdownCard.tsx
// Reusable card for per-patient sale breakdown (card / cash / company mix).

import type {
  UpsertPatientSaleBreakdownItem,
  PatientPaymentMethod,
} from './types';
import { formatAmount } from './patientFormatUtils';

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
};

const PAYMENT_METHOD_LABELS: { value: PatientPaymentMethod; label: string }[] =
  [
    { value: 'Kredi_Kartı', label: 'Kredi Kartı' },
    { value: 'Nakit', label: 'Nakit' },
    { value: 'Tim', label: 'Tim (Firma katkısı)' },
    { value: 'Sivantos', label: 'Sivantos (Firma katkısı)' },
    { value: 'Senet', label: 'Senet' },
  ];

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
}: PatientSaleBreakdownCardProps) {
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

      {isLoading && (
        <p className="text-[11px] text-sky-900">
          Ödeme dağılımı yükleniyor...
        </p>
      )}

      {!isLoading && items.length === 0 && (
        <p className="text-[11px] text-sky-900">
          Henüz ödeme dağılımı satırı yok. &quot;Satır ekle&quot; ile kart /
          nakit / firma katkısı gibi kalemleri girebilirsin.
        </p>
      )}

      {!isLoading && items.length > 0 && (
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
