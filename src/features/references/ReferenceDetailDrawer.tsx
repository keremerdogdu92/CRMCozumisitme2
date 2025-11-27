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
              Bu sekmede, <code>reference_links</code> tablosu üzerinden bu referans
              aracılığıyla gelen hastalar listelenecek. Henüz yalnızca iskelet olarak
              duruyor.
            </p>
          </section>
        )}

        {activeTab === 'gifts' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase">
              Hediye / Komisyon
            </h4>
            <p className="text-xs text-slate-500">
              Bu sekme, <code>reference_gifts</code> ve <code>payments</code> üzerinden
              hediye, komisyon ve kampanya takibini gösterecek. Şimdilik sadece açıklama
              metni yer alıyor.
            </p>
          </section>
        )}
      </div>
    </div>
  );
a// src/features/references/ReferenceDetailDrawer.tsx
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
              Bu sekmede, <code>reference_links</code> veya benzeri bir ilişki tablosu
              üzerinden bu referans aracılığıyla gelen hastalar listelenecek. Henüz
              yalnızca iskelet olarak duruyor.
            </p>
          </section>
        )}

        {activeTab === 'gifts' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase">
              Hediye / Komisyon
            </h4>
            <p className="text-xs text-slate-500">
              Bu sekme, <code>reference_payments</code> tablosu üzerinden hediye ve
              komisyon ödemelerini gösterecek. Şimdilik sadece açıklama metni yer
              alıyor.
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
