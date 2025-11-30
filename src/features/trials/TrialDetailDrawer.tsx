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
            <h4 className="text-xs font-semibold text-slate-500 uppercase">
              Özet
            </h4>
            <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 space-y-1">
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
            </div>
          </section>
        )}

        {activeTab === 'devices' && (
          <section className="space-y-2
