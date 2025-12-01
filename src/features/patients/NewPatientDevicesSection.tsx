// src/features/patients/NewPatientDevicesSection.tsx
// Device draft section used in the "New Patient" form.
// Allows adding simple per-ear device rows (brand/model/prices/note)
// which are passed upward as NewPatientDeviceDraft[].

import type { NewPatientDeviceDraft, NewPatientDeviceSide } from './types';

type NewPatientDevicesSectionProps = {
  items: NewPatientDeviceDraft[];
  onAddRow: () => void;
  onChangeRow: (
    index: number,
    patch: Partial<NewPatientDeviceDraft>,
  ) => void;
  onRemoveRow: (index: number) => void;
};

const SIDE_OPTIONS: { value: NewPatientDeviceSide; label: string }[] = [
  { value: '', label: 'Seçilmedi' },
  { value: 'right', label: 'Sağ' },
  { value: 'left', label: 'Sol' },
  { value: 'bilateral', label: 'Çift' },
];

export function NewPatientDevicesSection({
  items,
  onAddRow,
  onChangeRow,
  onRemoveRow,
}: NewPatientDevicesSectionProps) {
  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-[11px] text-slate-500">
          Henüz cihaz eklenmedi. Aşağıdan &quot;Cihaz ekle&quot; butonuna
          basarak kulak yönü, marka ve model bilgilerini girebilirsiniz.
        </p>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="space-y-2 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700">
                  Cihaz #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveRow(index)}
                  className="text-[11px] font-medium text-red-600 hover:underline"
                >
                  Sil
                </button>
              </div>

              {/* Row 1: Side + Brand + Model */}
              <div className="grid gap-2 md:grid-cols-12">
                <div className="md:col-span-3">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Kulak
                  </label>
                  <select
                    value={item.side}
                    onChange={(e) =>
                      onChangeRow(index, {
                        side: e.target.value as NewPatientDeviceSide,
                      })
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    {SIDE_OPTIONS.map((opt) => (
                      <option key={opt.value || 'empty'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-4">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Marka
                  </label>
                  <input
                    type="text"
                    value={item.brand}
                    onChange={(e) =>
                      onChangeRow(index, { brand: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Örn. Widex, Phonak..."
                  />
                </div>

                <div className="md:col-span-5">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Model
                  </label>
                  <input
                    type="text"
                    value={item.model}
                    onChange={(e) =>
                      onChangeRow(index, { model: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Örn. Moment 330 R"
                  />
                </div>
              </div>

              {/* Row 2: Prices */}
              <div className="grid gap-2 md:grid-cols-12">
                <div className="md:col-span-4">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Liste Fiyatı (tek cihaz)
                  </label>
                  <input
                    type="text"
                    value={item.listPrice}
                    onChange={(e) =>
                      onChangeRow(index, { listPrice: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Örn. 25.000"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Hastaya Satış (tek cihaz)
                  </label>
                  <input
                    type="text"
                    value={item.salePrice}
                    onChange={(e) =>
                      onChangeRow(index, { salePrice: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Örn. 22.500"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Not (opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={item.note}
                    onChange={(e) =>
                      onChangeRow(index, { note: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Renk, paket, kampanya notu..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex items-center rounded-md border border-dashed border-primary-300 px-3 py-1.5 text-xs font-medium text-primary-700 hover:border-primary-400 hover:bg-primary-50"
        >
          Cihaz ekle
        </button>
      </div>
    </div>
  );
}
