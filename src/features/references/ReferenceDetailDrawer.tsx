// src/features/references/ReferenceDetailDrawer.tsx
// Read-only detail drawer for a reference, with placeholder tabs for patients and gifts.

import { useState, useEffect } from 'react';
import { SideDrawer } from '../../components/layout/SideDrawer';
import type { ReferenceRow } from './types';
import { renderGroupLabel } from './utils';

type ReferenceDetailDrawerProps = {
  reference: ReferenceRow | null;
  open: boolean;
  onClose: () => void;
};

type ReferenceTabId = 'summary' | 'patients' | 'gifts';

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

  const next = new Date(last.getTime() + ref.contact_interval_days * MS_PER_DAY);
  const today = new Date();
  const diffDays = Math.floor((next.getTime() - today.getTime()) / MS_PER_DAY);

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

export function ReferenceDetailDrawer({
  reference,
  open,
  onClose,
}: ReferenceDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<ReferenceTabId>('summary');

  useEffect(() => {
    if (open) {
      setActiveTab('summary');
    }
  }, [open, reference?.id]);

  if (!reference) {
    return null;
  }

  const tabs: { id: ReferenceTabId; label: string }[] = [
    { id: 'summary', label: 'Özet' },
    { id: 'patients', label: 'Gönderilen Hastalar' },
    { id: 'gifts', label: 'Hediye / Komisyon' },
  ];

  const commissionSummary = (() => {
    if (reference.commission_scheme === 'percent') {
      const p = (reference.commission_percent ?? 0) * 100;
      return p ? `% ${p.toFixed(1)}` : '% 0';
    }
    if (reference.commission_scheme === 'fixed') {
      const v = reference.commission_fixed ?? 0;
      return `${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL`;
    }
    return '-';
  })();

  const reminderStatus = computeReminderStatus(reference);

  const content = (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="border-b border-slate-200 px-3 pt-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={
                  'rounded-md px-3 py-1.5 text-xs font-medium ' +
                  (isActive
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent')
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab contents */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm">
        {activeTab === 'summary' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase">Özet</h4>
            <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 space-y-1">
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
                <span className="text-xs text-slate-900">{commissionSummary}</span>
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
                    ? new Date(reference.last_meet_at).toLocaleDateString('tr-TR')
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Sonraki Görüşme</span>
                <span className="text-xs text-slate-900">
                  {reference.next_meet_at
                    ? new Date(reference.next_meet_at).toLocaleDateString('tr-TR')
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
                <div className="pt-2 border-t border-slate-200 mt-1">
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">
                    {reference.note}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'patients' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase">
              Gönderilen Hastalar
            </h4>
            <p className="text-xs text-slate-500">
              Bu sekmede bu referans üzerinden gelen hasta ve deneme kayıtları
              listelenecek. Bir sonraki adımda{' '}
              <code>patients</code> ve <code>trials</code> tablolarındaki
              <code>reference_id</code> alanları ile bağlayacağız; sadece yöneticiler bu
              bağlantıları güncelleyebilecek.
            </p>
          </section>
        )}

        {activeTab === 'gifts' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase">
              Hediye / Komisyon
            </h4>
            <p className="text-xs text-slate-500">
              Bu sekme, referansa bağlı hediye ve komisyon ödemelerini gösterecek. Kâr
              hesaplama ekranı ile entegrasyon, referans başına yapılan ödemeleri buradan
              da takip edebileceğiniz şekilde daha sonra eklenecek.
            </p>
          </section>
        )}
      </div>
    </div>
  );

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Referans Detayı"
      subtitle="İlişki geçmişi, gönderilen hastalar ve hediye/komisyon bilgileri"
    >
      {content}
    </SideDrawer>
  );
}
