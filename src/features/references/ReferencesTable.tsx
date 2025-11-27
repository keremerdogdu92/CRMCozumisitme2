// src/features/references/ReferencesTable.tsx
// Tabular list view for references with group, phone and commission info.

import type { ReferenceRow } from './types';

type ReferencesTableProps = {
  items: ReferenceRow[];
  onSelectRow: (ref: ReferenceRow) => void;
};

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('tr-TR');
}

function renderGroup(group: ReferenceRow['group']): string {
  switch (group) {
    case 'medikal':
      return 'Medikal';
    case 'doktor':
      return 'Doktor';
    case 'odyolog':
      return 'Odyolog';
    case 'dernek':
      return 'Dernek';
    default:
      return '-';
  }
}

function renderCommission(r: ReferenceRow): string {
  if (r.commission_scheme === 'percent') {
    const p = (r.commission_percent ?? 0) * 100;
    return p ? `% ${p.toFixed(1)}` : '% 0';
  }
  if (r.commission_scheme === 'fixed') {
    const v = r.commission_fixed ?? 0;
    return `${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL`;
  }
  return '-';
}

function renderStatus(r: ReferenceRow): string {
  return r.is_active ? 'Aktif' : 'Pasif';
}

export function ReferencesTable({ items, onSelectRow }: ReferencesTableProps) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        Filtreye uyan referans bulunamadı. Aramayı temizleyebilir veya yeni referans
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
            <th className="px-4 py-2 text-left font-medium text-slate-600">Grup</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Telefon</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              Varsayılan komisyon
            </th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              Son Görüşme
            </th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              Sonraki Görüşme
            </th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Durum</th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">Not</th>
            <th className="px-4 py-2 text-right font-medium text-slate-600">İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className="border-t border-slate-100">
              <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                {formatDate(r.created_at)}
              </td>
              <td className="px-4 py-2 text-slate-800">{r.full_name ?? '-'}</td>
              <td className="px-4 py-2 text-slate-700">{renderGroup(r.group)}</td>
              <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                {r.phone ?? '-'}
              </td>
              <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                {renderCommission(r)}
              </td>
              <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                {formatDate(r.last_meet_at)}
              </td>
              <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                {formatDate(r.next_meet_at)}
              </td>
              <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                {renderStatus(r)}
              </td>
              <td className="px-4 py-2 text-slate-500 max-w-xs truncate">
                {r.note ?? '-'}
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  type="button"
                  onClick={() => onSelectRow(r)}
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
