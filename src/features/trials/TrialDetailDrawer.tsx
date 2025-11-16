// src/features/trials/TrialDetailDrawer.tsx
// Read-only detail drawer for a trial, using SideDrawer with placeholder tabs.

import { useState, useEffect } from 'react';
import { SideDrawer } from '../../components/layout/SideDrawer';
import type { TrialRow } from './types';

type TrialDetailDrawerProps = {
  trial: TrialRow | null;
  open: boolean;
  onClose: () => void;
};

type TrialTabId = 'summary' | 'devices' | 'meetings';

export function TrialDetailDrawer({ trial, open, onClose }: TrialDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TrialTabId>('summary');

  useEffect(() => {
    if (open) {
      setActiveTab('summary');
    }
  }, [open, trial?.id]);

  if (!trial) {
    return null;
  }

  const tabs: { id: TrialTabId; label: string }[] = [
    { id: 'summary', label: 'Özet' },
    { id: 'devices', label: 'Deneme Cihazları' },
    { id: 'meetings', label: 'Görüşmeler' },
  ];

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
                <span className="text-xs text-slate-500">Ad Soyad</span>
                <span className="text-xs font-medium text-slate-900">
                  {trial.full_name ?? '-'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Telefon</span>
                <span className="text-xs text-slate-900">{trial.phone ?? '-'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Kayıt Tarihi</span>
                <span className="text-xs text-slate-900">
                  {new Date(trial.created_at).toLocaleString('tr-TR')}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">İlk Görüşme</span>
                <span className="text-xs text-slate-900">
                  {trial.first_meet_at
                    ? new Date(trial.first_meet_at).toLocaleString('tr-TR')
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Sonraki Randevu</span>
                <span className="text-xs text-slate-900">
                  {trial.next_meet_at
                    ? new Date(trial.next_meet_at).toLocaleString('tr-TR')
                    : '-'}
                </span>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'devices' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase">
              Deneme Cihazları
            </h4>
            <p className="text-xs text-slate-500">
              Buraya bu denemede kullanılan cihazlar eklenecek. Çift cihaz + toplam fiyat
              akışı, veri tabanındaki <code>trial_devices</code> satırlarıyla
              eşleştirilerek yönetilecek (çift cihaz için iki satır, arayüzde tek paket).
            </p>
          </section>
        )}

        {activeTab === 'meetings' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase">
              Görüşmeler
            </h4>
            <p className="text-xs text-slate-500">
              Bu sekmede tarih bazlı görüşme listesi, not alanı, memnuniyet ve sonraki
              randevu bilgileri gösterilecek. <code>meetings</code> tablosu{' '}
              <code>trial_id</code> üzerinden bağlanacak.
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
      title="Deneme Detayı"
      subtitle="Kişi bilgileri, deneme cihazları ve görüşme süreci"
    >
      {content}
    </SideDrawer>
  );
}
