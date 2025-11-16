// src/features/trials/TrialsTable.tsx
// Tabular list view for trial rows with basic columns and a "Detay" action.

import type { TrialRow } from './types';

type TrialsTableProps = {
  items: TrialRow[];
  onSelectRow: (trial: TrialRow) => void;
};

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TrialsTable({ items, onSelectRow }: TrialsTableProps) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        Filtreye uyan deneme kaydı bulunamadı. Aramayı temizleyebilir veya yeni deneme
        ekleyebilirsiniz.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Kayıt</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Ad Soyad</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Telefon</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              İlk Görüşme
            </th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              Sonraki Randevu
            </th>
            <th className="px-4 py-2 text-right font-medium text-slate-600">İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id} className="border-t border-slate-100">
              <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                {formatDate(t.created_at)}
              </td>
              <td className="px-4 py-2 text-slate-800">{t.full_name ?? '-'}</td>
              <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                {t.phone ?? '-'}
              </td>
              <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                {formatDate(t.first_meet_at)}
              </td>
              <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                {formatDate(t.next_meet_at)}
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  type="button"
                  onClick={() => onSelectRow(t)}
                  className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Detay
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
