// src/features/meetings/MeetingsTable.tsx
// Simple table listing meetings.

import { useMeetingsQuery } from './api';

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
}

export function MeetingsTable() {
  const { data, isLoading, isError, error } = useMeetingsQuery();

  if (isLoading) {
    return <p className="text-xs text-slate-500">Görüşmeler yükleniyor...</p>;
  }

  if (isError) {
    return (
      <p className="text-xs text-red-600">
        Görüşmeler yüklenirken hata oluştu:{' '}
        {(error as Error)?.message ?? 'Bilinmeyen hata'}
      </p>
    );
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Henüz kayıtlı görüşme yok. Yukarıdan yeni bir görüşme ekleyebilirsiniz.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">Tarih</th>
            <th className="px-3 py-2 font-medium">Başlık</th>
            <th className="px-3 py-2 font-medium">Sonraki Tarih</th>
            <th className="px-3 py-2 font-medium">Memnuniyet</th>
            <th className="px-3 py-2 font-medium">Not</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-t border-slate-100">
              <td className="px-3 py-2 text-slate-800">
                {formatDate(m.at)}
              </td>
              <td className="px-3 py-2 text-slate-800">
                {m.subject ?? '-'}
              </td>
              <td className="px-3 py-2 text-slate-800">
                {formatDate(m.next_at)}
              </td>
              <td className="px-3 py-2 text-slate-800">
                {m.satisfaction_10 ?? '-'}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {m.note ? m.note.slice(0, 120) : '-'}
                {m.note && m.note.length > 120 ? '…' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
