// src/features/meetings/MeetingsTable.tsx
// Meetings list table with meeting_type + subject info and simple filters.

import { useState } from 'react';
import { useMeetingsQuery } from './api';
import type { MeetingRow, MeetingType } from './types';

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
}

function formatMeetingType(type: MeetingType): string {
  switch (type) {
    case 'patient':
      return 'Hasta';
    case 'trial':
      return 'Deneme';
    case 'reference':
      return 'Referans';
    default:
      return 'Diğer';
  }
}

interface FilterButtonProps {
  label: string;
  value: MeetingType | 'all';
  current: MeetingType | 'all';
  onChange: (v: MeetingType | 'all') => void;
}

function FilterButton({ label, value, current, onChange }: FilterButtonProps) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`rounded-full px-3 py-1 text-xs font-medium border ${
        active
          ? 'bg-primary-50 border-primary-300 text-primary-700'
          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

export function MeetingsTable() {
  const { data, isLoading, isError, error } = useMeetingsQuery();
  const [typeFilter, setTypeFilter] = useState<MeetingType | 'all'>('all');

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

  // Eski kayıtlar için default değerler atayıp MeetingRow tipine normalize et
  const rows: MeetingRow[] = (data ?? []).map((m) => {
    const meeting_type = (m.meeting_type ?? 'patient') as MeetingType;
    const subject_name = (m.subject_name ?? null) as string | null;
    const subject_id = (m.subject_id ?? null) as string | null;

    return {
      ...m,
      meeting_type,
      subject_name,
      subject_id,
    };
  });

  const filteredRows =
    typeFilter === 'all'
      ? rows
      : rows.filter((m) => m.meeting_type === typeFilter);

  if (rows.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Henüz kayıtlı görüşme yok. Yukarıdan yeni bir görüşme ekleyebilirsiniz.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">
          Toplam <span className="font-semibold">{rows.length}</span> görüşme
          kaydı var.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <FilterButton
            label="Tümü"
            value="all"
            current={typeFilter}
            onChange={setTypeFilter}
          />
          <FilterButton
            label="Hastalar"
            value="patient"
            current={typeFilter}
            onChange={setTypeFilter}
          />
          <FilterButton
            label="Deneme hastaları"
            value="trial"
            current={typeFilter}
            onChange={setTypeFilter}
          />
          <FilterButton
            label="Referanslar"
            value="reference"
            current={typeFilter}
            onChange={setTypeFilter}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Tarih</th>
              <th className="px-3 py-2 font-medium">Tip</th>
              <th className="px-3 py-2 font-medium">Kişi</th>
              <th className="px-3 py-2 font-medium">Başlık</th>
              <th className="px-3 py-2 font-medium">Sonraki Tarih</th>
              <th className="px-3 py-2 font-medium">Memnuniyet</th>
              <th className="px-3 py-2 font-medium">Not</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-800">
                  {formatDate(m.at)}
                </td>
                <td className="px-3 py-2 text-slate-800">
                  {formatMeetingType(m.meeting_type)}
                </td>
                <td className="px-3 py-2 text-slate-800">
                  {m.subject_name ?? '-'}
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

      {filteredRows.length === 0 && (
        <p className="text-[11px] text-slate-500">
          Bu filtreye uygun görüşme yok. Farklı bir filtre seçmeyi deneyin.
        </p>
      )}
    </div>
  );
}
