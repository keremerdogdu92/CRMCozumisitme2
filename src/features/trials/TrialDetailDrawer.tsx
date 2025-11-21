// src/features/trials/TrialDetailDrawer.tsx
// Read-only detail drawer for a trial, with tabs and printable offer sheet.

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SideDrawer } from '../../components/layout/SideDrawer';
import type { TrialRow, TrialDeviceRow } from './types';
import {
  fetchTrialDevicesByTrialId,
  TRIAL_DEVICES_BY_TRIAL_QUERY_KEY,
} from './api';
import { openTrialOfferPrint } from './printTrialOffer';

type TrialDetailDrawerProps = {
  trial: TrialRow | null;
  open: boolean;
  onClose: () => void;
};

type TrialTabId = 'summary' | 'devices' | 'meetings';

function formatPrice(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '-';
  try {
    return amount.toLocaleString('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
    });
  } catch {
    return `${amount}`;
  }
}

export function TrialDetailDrawer({ trial, open, onClose }: TrialDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TrialTabId>('summary');

  // Stabil key için trialId'yi yukarıda hesaplıyoruz
  const trialId = trial?.id ?? null;

  const {
    data: devices = [],
    isLoading: isDevicesLoading,
    isError: isDevicesError,
  } = useQuery({
    queryKey: TRIAL_DEVICES_BY_TRIAL_QUERY_KEY(trialId ?? 'none'),
    queryFn: () => fetchTrialDevicesByTrialId(trialId as string),
    enabled: !!trialId && open,
  });

  useEffect(() => {
    if (open) {
      setActiveTab('summary');
    }
  }, [open, trialId]);

  if (!trial) {
    return null;
  }

  const typedDevices = devices as TrialDeviceRow[];

  const tabs: { id: TrialTabId; label: string }[] = [
    { id: 'summary', label: 'Özet' },
    { id: 'devices', label: 'Deneme Cihazları' },
    { id: 'meetings', label: 'Görüşmeler' },
  ];

  const handlePrintOffer = () => {
    if (typedDevices.length === 0) return;
    openTrialOfferPrint(trial, typedDevices);
  };

  const content = (
    <div className="flex h-full flex-col">
      {/* Tab bar + print button */}
      <div className="border-b border-slate-200 px-3 pt-2">
        <div className="flex items-center justify-between gap-2">
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

          <button
            type="button"
            onClick={handlePrintOffer}
            disabled={typedDevices.length === 0}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Teklif Yazdır
          </button>
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

            {isDevicesLoading && (
              <p className="text-xs text-slate-500">Cihazlar yükleniyor...</p>
            )}

            {isDevicesError && (
              <p className="text-xs text-red-600">
                Cihazlar alınırken bir hata oluştu. Lütfen tekrar deneyin.
              </p>
            )}

            {!isDevicesLoading && !isDevicesError && typedDevices.length === 0 && (
              <p className="text-xs text-slate-500">
                Bu deneme için kayıtlı cihaz satırı bulunmuyor.
              </p>
            )}

            {!isDevicesLoading && !isDevicesError && typedDevices.length > 0 && (
              <div className="space-y-2">
                <table className="min-w-full border border-slate-200 text-[11px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-2 py-1 text-left font-medium text-slate-600">
                        #
                      </th>
                      <th className="border-b border-slate-200 px-2 py-1 text-left font-medium text-slate-600">
                        Marka
                      </th>
                      <th className="border-b border-slate-200 px-2 py-1 text-left font-medium text-slate-600">
                        Model
                      </th>
                      <th className="border-b border-slate-200 px-2 py-1 text-left font-medium text-slate-600">
                        Kulak
                      </th>
                      <th className="border-b border-slate-200 px-2 py-1 text-right font-medium text-slate-600">
                        Teklif (Satır)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {typedDevices.map((d, index) => (
                      <tr key={d.id}>
                        <td className="border-b border-slate-100 px-2 py-1">
                          {index + 1}
                        </td>
                        <td className="border-b border-slate-100 px-2 py-1">
                          {d.brand ?? '-'}
                        </td>
                        <td className="border-b border-slate-100 px-2 py-1">
                          {d.model ?? '-'}
                        </td>
                        <td className="border-b border-slate-100 px-2 py-1">
                          {d.side ?? '-'}
                        </td>
                        <td className="border-b border-slate-100 px-2 py-1 text-right">
                          {formatPrice(d.quote_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Toplam teklif satırı bilinçli olarak kaldırıldı; hasta genelde
                    bu satırlardan yalnızca birini seçeceği için kafa karışıklığı
                    yaratmaması adına gösterilmiyor. */}
              </div>
            )}
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
