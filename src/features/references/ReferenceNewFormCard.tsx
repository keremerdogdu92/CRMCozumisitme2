// src/features/references/ReferenceNewFormCard.tsx
// Inline create card for adding new references.

import type { FormEvent } from 'react';
import { InlineCreateCard } from '../../components/layout/InlineCreateCard';
import type { NewReferenceForm, ReferenceGroup } from './types';

type ReferenceNewFormCardProps = {
  open: boolean;
  onToggle: () => void;
  values: NewReferenceForm;
  onChange: (patch: Partial<NewReferenceForm>) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  errorMessage?: string;
};

const GROUP_OPTIONS: { value: ReferenceGroup; label: string }[] = [
  { value: '', label: 'Seçilmedi' },
  { value: 'medikal', label: 'Medikal' },
  { value: 'doktor', label: 'Doktor' },
  { value: 'odyolog', label: 'Odyolog' },
  { value: 'dernek', label: 'Dernek' },
];

export function ReferenceNewFormCard({
  open,
  onToggle,
  values,
  onChange,
  onSubmit,
  isSubmitting,
  errorMessage,
}: ReferenceNewFormCardProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!values.fullName.trim()) return;
    onSubmit();
  };

  return (
    <InlineCreateCard
      title="Yeni Referans"
      description="Referans kişi/kurumu kaydedin, görüşme tarihlerini planlayın."
      open={open}
      onToggle={onToggle}
      errorMessage={errorMessage}
    >
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 md:grid-cols-4 md:items-start"
      >
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Ad Soyad / Kurum
          </label>
          <input
            type="text"
            required
            value={values.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Örn. Dr. Ali Medikal"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Grup
          </label>
          <select
            value={values.group}
            onChange={(e) => onChange({ group: e.target.value as ReferenceGroup })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {GROUP_OPTIONS.map((opt) => (
              <option key={opt.value || 'none'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Son Görüşme Tarihi
          </label>
          <input
            type="date"
            value={values.lastMeetAt}
            onChange={(e) => onChange({ lastMeetAt: e.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Sonraki Görüşme Tarihi
          </label>
          <input
            type="date"
            value={values.nextMeetAt}
            onChange={(e) => onChange({ nextMeetAt: e.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="md:col-span-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Not
          </label>
          <textarea
            rows={3}
            value={values.note}
            onChange={(e) => onChange({ note: e.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Kampanya, komisyon, ilişkilerle ilgili kısa not..."
          />
        </div>

        <div className="md:col-span-4 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </InlineCreateCard>
  );
}
