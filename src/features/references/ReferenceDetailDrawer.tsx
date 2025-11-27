// src/features/references/ReferenceDetailDrawer.tsx
// Read-only detail drawer for a reference, with placeholder tabs for patients and gifts.

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SideDrawer } from '../../components/layout/SideDrawer';
import type { ReferenceRow } from './types';
import { renderGroupLabel } from './utils';
import type { TrialRow } from '../trials/types';
import {
  TRIALS_BY_REFERENCE_QUERY_KEY,
  fetchTrialsByReferenceId,
} from '../trials/api';

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

  const referenceId = reference?.id ?? '';

  const {
    data: trialsForReference = [],
    isLoading: isLoadingTrials,
    isError: isTrialsError,
  } = useQuery<TrialRow[]>({
    queryKey: TRIALS_BY_REFERENCE_QUERY_KEY(referenceId),
    queryFn: () => fetchTrialsByReferenceId(referenceId),
    enabled: !!referenceId && open && activeTab === 'patients',
  });

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

            {isLoadingTrials && (
              <p className="text-xs text-slate-500">Kayıtlar yükleniyor...</p>
            )}

            {isTrialsError && !isLoadingTrials && (
              <p className="text-xs text-red-600">
                Gönderilen kayıtlar yüklenirken bir hata oluştu.
              </p>
            )}

            {!isLoadingTrials &&
              !isTrialsError &&
              trialsForReference.length === 0 && (
                <p className="text-xs text-slate-500">
                  Bu referansa bağlı deneme veya hasta kaydı henüz yok.
                </p>
              )}

            {!isLoadingTrials &&
              !isTrialsError &&
              trialsForReference.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                          Kayıt
                        </th>
                        <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                          Ad Soyad
                        </th>
                        <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                          Telefon
                        </th>
                        <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                          İlk Görüşme
                        </th>
                        <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                          Sonraki Randevu
                        </th>
                        <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                          Tür
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialsForReference.map((t) => (
                        <tr key={t.id} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                            {t.created_at
                              ? new Date(t.created_at).toLocaleDateString('tr-TR')
                              : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-slate-800 whitespace-nowrap">
                            {t.full_name ?? '-'}
                          </td>
                          <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                            {t.phone ?? '-'}
                          </td>
                          <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                            {t.first_meet_at
                              ? new Date(t.first_meet_at).toLocaleDateString('tr-TR')
                              : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                            {t.next_meet_at
                              ? new Date(t.next_meet_at).toLocaleDateString('tr-TR')
                              : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                            Deneme hastası
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            <p className="text-[11px] text-slate-500">
              İleride bu listeye normal hasta kayıtları da eklenecek. Referans
              bağlantılarını sadece yönetici rolündeki kullanıcılar değiştirebilecek.
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
