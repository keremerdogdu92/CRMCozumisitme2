// src/features/references/ReferencesTable.tsx
// Tabular list view for references with group, phone, commission and follow-up info.

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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function computeReminderStatus(
  r: ReferenceRow,
): { label: string; className: string } {
  if (!r.contact_interval_days || r.contact_interval_days <= 0) {
    return { label: '-', className: 'text-slate-400' };
  }

  if (!r.last_meet_at) {
    return {
      label: 'Hiç görüşme yok',
      className: 'text-amber-600 font-medium',
    };
  }

  const last = new Date(r.last_meet_at);
  if (Number.isNaN(last.getTime())) {
    return { label: '-', className: 'text-slate-400' };
  }

  const next = new Date(
    last.getTime() + r.contact_interval_days * MS_PER_DAY,
  );
  const today = new Date();
  const diffDays = Math.floor(
    (next.getTime() - today.getTime()) / MS_PER_DAY,
  );

  if (diffDays < 0) {
    return {
      label: `${Math.abs(diffDays)} gün gecikti`,
      className: 'text-red-600 font-medium',
    };
  }

  if (diffDays <= 7) {
    return {
      label: `${diffDays} gün içinde`,
      className: 'text-amber-600 font-medium',
    };
  }

  return {
    label: `${diffDays} gün sonra`,
    className: 'text-emerald-700',
  };
}

export function ReferencesTable({
  items,
  onSelectRow,
}: ReferencesTableProps) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        Filtreye uyan referans bulunamadı. Aramayı temizleyebilir veya
        yeni referans ekleyebilirsiniz.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              Kayıt
            </th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              Ad Soyad
            </th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              Grup
            </th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              Telefon
            </th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              Varsayılan komisyon
            </th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              Son Görüşme
            </th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              Sonraki Görüşme
            </th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              Takip
            </th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              Durum
            </th>
            <th className="px-4 py-2 text-left font-medium text-slate-600">
              Not
            </th>
            <th className="px-4 py-2 text-right font-medium text-slate-600">
              İşlemler
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => {
            const reminder = computeReminderStatus(r);
            return (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                  {formatDate(r.created_at)}
                </td>
                <td className="px-4 py-2 text-slate-800">
                  {r.full_name ?? '-'}
                </td>
                <td className="px-4 py-2 text-slate-700">
                  {renderGroup(r.group)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                  {r.phone ?? '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                  {renderCommission(r)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                  {formatDate(r.last_meet_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                  {formatDate(r.next_meet_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-2">
                  <span className={reminder.className}>
                    {reminder.label}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                  {renderStatus(r)}
                </td>
                <td className="max-w-xs truncate px-4 py-2 text-slate-500">
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
