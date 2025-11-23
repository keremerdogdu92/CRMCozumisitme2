// src/features/meetings/MeetingsTable.tsx
// Simple table that lists meetings for the current org using useMeetingsQuery.

import { useMeetingsQuery } from './api';
import type { MeetingRow } from './types';

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('tr-TR');
}

function formatSatisfaction(value: number | null | undefined): string {
  if (value == null) return '-';
  return String(value);
}

export function MeetingsTable() {
  const { data, isLoading, isError, error } = useMeetingsQuery();

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
        Görüşmeler yükleniyor…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        Görüşmeler yüklenirken hata oluştu:{' '}
        {(error as Error)?.message ?? 'Bilinmeyen hata'}
      </div>
    );
  }

  const rows = (data ?? []) as MeetingRow[];

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
        Henüz kayıtlı görüşme yok. Yukarıdan yeni bir görüşme ekleyebilirsiniz.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">Başlık</th>
            <th className="px-3 py-2 font-medium">Görüşme Tarihi</th>
            <th className="px-3 py-2 font-medium">Sonraki Tarih</th>
            <th className="px-3 py-2 font-medium">Memnuniyet</th>
            <th className="px-3 py-2 font-medium">Not</th>
            <th className="px-3 py-2 font-medium">Oluşturulma</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((m) => (
            <tr key={m.id}>
              <td className="px-3 py-2 text-slate-900">
                {m.subject ?? '(Başlıksız)'}
              </td>
              <td className="px-3 py-2 text-slate-800">
                {formatDate(m.at as string | null)}
              </td>
              <td className="px-3 py-2 text-slate-800">
                {formatDate(m.next_at as string | null)}
              </td>
              <td className="px-3 py-2 text-slate-800">
                {formatSatisfaction(m.satisfaction_10 as number | null)}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {m.note ? m.note.slice(0, 120) : '-'}
                {m.note && m.note.length > 120 ? '…' : ''}
              </td>
              <td className="px-3 py-2 text-slate-500">
                {formatDate(m.created_at as string | null)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
