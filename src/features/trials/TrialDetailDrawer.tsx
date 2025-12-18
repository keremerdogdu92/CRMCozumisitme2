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
import {
  fetchReferenceLiteById,
  type ReferenceLiteForTrial,
} from '../references/api';
import type { MeetingRow } from '../meetings/types';
import {
  MEETINGS_BY_TRIAL_QUERY_KEY,
  fetchMeetingsByTrialId,
} from '../meetings/api';
import { useOrgSettings } from '../settings/useOrgSettings';

type TrialDetailDrawerProps = {
  trial: TrialRow | null;
  open: boolean;
  onClose: () => void;
};

type TrialTabId = 'summary' | 'devices' | 'meetings';

function formatPrice(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount as number)) return '-';
  try {
    const n = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(n)) return `${amount}`;
    return n.toLocaleString('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
    });
  } catch {
    return `${amount}`;
  }
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return '-';
  }
}

export function TrialDetailDrawer({
  trial,
  open,
  onClose,
}: TrialDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TrialTabId>('summary');
  const [includeDetailsForPrint, setIncludeDetailsForPrint] = useState<boolean>(true);

  // Org ayarları (logo, firma adı, iletişim bilgileri, watermark)
  const { data: orgSettings } = useOrgSettings();

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

  // Referans adını çekmek için hafif sorgu
  const referenceId = trial?.reference_id ?? null;

  const {
    data: referenceLite,
    isLoading: isReferenceLoading,
    isError: isReferenceError,
  } = useQuery<ReferenceLiteForTrial | null>({
    queryKey: ['reference-lite-by-id', referenceId],
    queryFn: () => fetchReferenceLiteById(referenceId as string),
    enabled: !!referenceId && open,
  });

  // Bu deneme hastasına bağlı görüşmeler
  const {
    data: meetings = [],
    isLoading: isMeetingsLoading,
    isError: isMeetingsError,
    error: meetingsError,
  } = useQuery<MeetingRow[]>({
    queryKey: MEETINGS_BY_TRIAL_QUERY_KEY(trialId ?? 'none'),
    queryFn: () => fetchMeetingsByTrialId(trialId as string),
    enabled: !!trialId && open,
  });

  useEffect(() => {
    if (open) {
      setActiveTab('summary');
      setIncludeDetailsForPrint(true);
    }
  }, [open, trialId]);

  if (!trial) {
    return null;
  }

  const typedDevices = devices as TrialDeviceRow[];
  const typedMeetings = meetings as MeetingRow[];

  const tabs: { id: TrialTabId; label: string }[] = [
    { id: 'summary', label: 'Özet' },
    { id: 'devices', label: 'Deneme Cihazları' },
    { id: 'meetings', label: 'Görüşmeler' },
  ];

  const handlePrintOffer = () => {
    if (typedDevices.length === 0) return;

    openTrialOfferPrint(trial, typedDevices, orgSettings ?? null, {
      includeDeviceDetails: includeDetailsForPrint,
    });
  };

  const content = (
    <div className="flex h-full flex-col">
      {/* Tab bar + print controls */}
      <div className="border-b border-slate-200 px-3 pt-2">
        <div className="flex items-start justify-between gap-3">
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

          <div className="flex flex-col items-end gap-1">
            <label className="flex items-center gap-1 text-[11px] text-slate-600">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-slate-300"
                checked={includeDetailsForPrint}
                onChange={(e) => setIncludeDetailsForPrint(e.target.checked)}
              />
              <span>Detaylı çıktı (katalog özellikleri)</span>
            </label>

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
      </div>

      {/* Tab contents */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
        {activeTab === 'summary' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-slate-500">
              Özet
            </h4>
            <div className="space-y-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Ad Soyad</span>
                <span className="text-xs font-medium text-slate-900">
                  {trial.full_name ?? '-'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Telefon</span>
                <span className="text-xs text-slate-900">
                  {trial.phone ?? '-'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Kayıt Tarihi</span>
                <span className="text-xs text-slate-900">
                  {formatDate(trial.created_at)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">İlk Görüşme</span>
                <span className="text-xs text-slate-900">
                  {trial.first_meet_at ? formatDate(trial.first_meet_at) : '-'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Sonraki Randevu</span>
                <span className="text-xs text-slate-900">
                  {trial.next_meet_at ? formatDate(trial.next_meet_at) : '-'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-500">Referans</span>
                <span className="text-xs text-slate-900">
                  {!referenceId
                    ? '-'
                    : isReferenceLoading
                    ? 'Yükleniyor...'
                    : isReferenceError
                    ? 'Referans yüklenemedi'
                    : referenceLite?.full_name ?? '-'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">Not</span>
                <span className="whitespace-pre-line text-xs text-slate-900">
                  {trial.note && trial.note.trim() ? trial.note : '-'}
                </span>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'devices' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-slate-500">
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

            {!isDevicesLoading &&
              !isDevicesError &&
              typedDevices.length === 0 && (
                <p className="text-xs text-slate-500">
                  Bu deneme için kayıtlı cihaz satırı bulunmuyor.
                </p>
              )}

            {!isDevicesLoading &&
              !isDevicesError &&
              typedDevices.length > 0 && (
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
                          Liste Fiyatı
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
                            {formatPrice(d.list_price ?? null)}
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
            <h4 className="text-xs font-semibold uppercase text-slate-500">
              Görüşmeler
            </h4>

            {isMeetingsLoading && (
              <p className="text-xs text-slate-500">
                Görüşmeler yükleniyor...
              </p>
            )}

            {isMeetingsError && (
              <p className="text-xs text-red-600">
                Görüşmeler alınırken bir hata oluştu:{' '}
                {(meetingsError as Error)?.message ?? 'Bilinmeyen hata'}
              </p>
            )}

            {!isMeetingsLoading &&
              !isMeetingsError &&
              typedMeetings.length === 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    Bu deneme hastası için kayıtlı görüşme bulunmuyor.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Yeni görüşme eklemek için üst menüden{' '}
                    <span className="font-semibold">Görüşmeler</span> ekranına
                    gidip, görüşme tipi olarak{' '}
                    <span className="font-semibold">Deneme hastası</span>{' '}
                    seçerek ilgili kişiyi seçebilirsiniz.
                  </p>
                </div>
              )}

            {!isMeetingsLoading &&
              !isMeetingsError &&
              typedMeetings.length > 0 && (
                <div className="space-y-2">
                  <table className="min-w-full border border-slate-200 text-[11px]">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium">
                          Tarih
                        </th>
                        <th className="px-2 py-1 text-left font-medium">
                          Başlık
                        </th>
                        <th className="px-2 py-1 text-left font-medium">
                          Sonraki Tarih
                        </th>
                        <th className="px-2 py-1 text-left font-medium">
                          Memnuniyet
                        </th>
                        <th className="px-2 py-1 text-left font-medium">
                          Not
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {typedMeetings.map((m) => (
                        <tr
                          key={m.id}
                          className="border-t border-slate-100 align-top"
                        >
                          <td className="px-2 py-1 text-slate-800">
                            {formatDate(m.at)}
                          </td>
                          <td className="px-2 py-1 text-slate-800">
                            {m.subject ?? '-'}
                          </td>
                          <td className="px-2 py-1 text-slate-800">
                            {formatDate(m.next_at)}
                          </td>
                          <td className="px-2 py-1 text-slate-800">
                            {m.satisfaction_10 ?? '-'}
                          </td>
                          <td className="px-2 py-1 text-slate-600">
                            {m.note ? m.note.slice(0, 160) : '-'}
                            {m.note && m.note.length > 160 ? '…' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-slate-400">
                    Yeni görüşme eklemek için{' '}
                    <span className="font-semibold">Görüşmeler</span> ana
                    ekranını kullanın. Bu sekme sadece ilgili deneme
                    görüşmelerini görüntüler.
                  </p>
                </div>
              )}
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
