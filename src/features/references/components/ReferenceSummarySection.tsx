// src/features/references/components/ReferenceSummarySection.tsx
// Summary: Summary tab content for reference detail drawer: core info, commission, reminder status.

import React from 'react';
import type { ReferenceRow } from '../types';
import { renderGroupLabel } from '../utils';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function computeReminderStatus(ref: ReferenceRow): {
  label: string;
  className: string;
} {
  if (!ref.contact_interval_days || ref.contact_interval_days <= 0) {
    return { label: '-', className: 'text-slate-400' };
  }

  if (!ref.last_meet_at) {
    return {
      label: 'Hiç görüşme yok',
      className: 'text-amber-600 font-medium',
    };
  }

  const last = new Date(ref.last_meet_at);
  if (Number.isNaN(last.getTime())) {
    return { label: '-', className: 'text-slate-400' };
  }

  const next = new Date(
    last.getTime() + ref.contact_interval_days * MS_PER_DAY,
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

type ReferenceSummarySectionProps = {
  reference: ReferenceRow;
};

export const ReferenceSummarySection: React.FC<ReferenceSummarySectionProps> = ({
  reference,
}) => {
  const commissionSummary = (() => {
    if (reference.commission_scheme === 'percent') {
      const p = (reference.commission_percent ?? 0) * 100;
      return p ? `% ${p.toFixed(1)}` : '% 0';
    }
    if (reference.commission_scheme === 'fixed') {
      const v = reference.commission_fixed ?? 0;
      return `${v.toLocaleString('tr-TR', {
        maximumFractionDigits: 2,
      })} TL`;
    }
    return '-';
  })();

  const reminderStatus = computeReminderStatus(reference);

  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase text-slate-500">
        Özet
      </h4>
      <div className="space-y-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Ad Soyad / Kurum</span>
          <span className="text-xs font-medium text-slate-900">
            {reference.full_name ?? '-'}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Grup</span>
          <span className="text-xs text-slate-900">
            {renderGroupLabel(reference.group)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Telefon</span>
          <span className="text-xs text-slate-900">
            {reference.phone ?? '-'}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Varsayılan komisyon</span>
          <span className="text-xs text-slate-900">
            {commissionSummary}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Durum</span>
          <span className="text-xs text-slate-900">
            {reference.is_active ? 'Aktif' : 'Pasif'}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Kayıt Tarihi</span>
          <span className="text-xs text-slate-900">
            {new Date(reference.created_at).toLocaleDateString('tr-TR')}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Son Görüşme</span>
          <span className="text-xs text-slate-900">
            {reference.last_meet_at
              ? new Date(
                  reference.last_meet_at,
                ).toLocaleDateString('tr-TR')
              : '-'}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Sonraki Görüşme</span>
          <span className="text-xs text-slate-900">
            {reference.next_meet_at
              ? new Date(
                  reference.next_meet_at,
                ).toLocaleDateString('tr-TR')
              : '-'}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Görüşme sıklığı</span>
          <span className="text-xs text-slate-900">
            {reference.contact_interval_days
              ? `${reference.contact_interval_days} günde bir`
              : '-'}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Takip durumu</span>
          <span className={'text-xs ' + reminderStatus.className}>
            {reminderStatus.label}
          </span>
        </div>
        {reference.note && (
          <div className="mt-1 border-t border-slate-200 pt-2">
            <p className="whitespace-pre-wrap text-xs text-slate-700">
              {reference.note}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
