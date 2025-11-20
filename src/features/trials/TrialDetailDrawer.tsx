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
  // IMPORTANT:
  // Early return BEFORE any hooks so that hook sayısı her render'da tutarlı kalsın.
  // (React #310 hatasını engeller.)
  if (!trial) {
    return null;
  }

  const [activeTab, setActiveTab] = useState<TrialTabId>('summary');

  useEffect(() => {
    if (open) {
      setActiveTab('summary');
    }
  }, [open, trial.id]);

  const {
    data: devices = [],
    isLoading: isDevicesLoading,
    isError: isDevicesError,
  } = useQuery({
    queryKey: TRIAL_DEVICES_BY_TRIAL_QUERY_KEY(trial.id),
    queryFn: () => fetchTrialDevicesByTrialId(trial.id),
    enabled: open && !!trial.id,
  });

  const totalQuoted = devices.reduce(
    (sum, d) => sum + (Number(d.quote_price) || 0),
    0,
  );

  const tabs: { id: TrialTabId; label: string }[] = [
    { id: 'summary', label: 'Özet' },
    { id: 'devices', label: 'Deneme Cihazları' },
    { id: 'meetings', label: 'Görüşmeler' },
  ];

  const handlePrintOffer = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    if (!printWindow) return;

    const deviceRowsHtml = (devices as TrialDeviceRow[])
      .map((d, index) => {
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${d.brand ?? ''}</td>
            <td>${d.model ?? ''}</td>
            <td>${d.side ?? ''}</td>
            <td style="text-align:right;">${formatPrice(d.quote_price)}</td>
          </tr>
        `;
      })
      .join('');

    const html = `
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Deneme Teklifi - ${trial.full_name ?? ''}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      font-size: 12px;
      color: #111827;
      margin: 0;
      padding: 0;
    }
    .page {
      padding: 0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
    }
    .subtitle {
      font-size: 12px;
      color: #6b7280;
    }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      margin-top: 16px;
      margin-bottom: 4px;
    }
    .info-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .info-grid td {
      padding: 3px 0;
      font-size: 11px;
    }
    .info-label {
      color: #6b7280;
      width: 30%;
    }
    .info-value {
      font-weight: 500;
    }
    table.offer-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 11px;
    }
    table.offer-table th,
    table.offer-table td {
      border: 1px solid #e5e7eb;
      padding: 6px 8px;
    }
    table.offer-table th {
      background: #f3f4f6;
      text-align: left;
    }
    .totals {
      margin-top: 8px;
      text-align: right;
      font-size: 12px;
      font-weight: 600;
    }
    .notes {
      margin-top: 16px;
      font-size: 11px;
    }
    .notes-box {
      border: 1px solid #e5e7eb;
      min-height: 80px;
      padding: 6px 8px;
      margin-top: 4px;
    }
    .signature-row {
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
    }
    .signature-box {
      width: 45%;
    }
    .signature-line {
      margin-top: 32px;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="title">Deneme Cihaz Teklifi</div>
        <div class="subtitle">Çözüm İşitme Merkezi</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#6b7280;">
        <div>Tarih: ${new Date().toLocaleDateString('tr-TR')}</div>
        <div>Saat: ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>

    <div class="section-title">Hasta Bilgileri</div>
    <table class="info-grid">
      <tr>
        <td class="info-label">Ad Soyad</td>
        <td class="info-value">${trial.full_name ?? '-'}</td>
      </tr>
      <tr>
        <td class="info-label">Telefon</td>
        <td class="info-value">${trial.phone ?? '-'}</td>
      </tr>
      <tr>
        <td class="info-label">İlk Görüşme</td>
        <td class="info-value">${
          trial.first_meet_at
            ? new Date(trial.first_meet_at).toLocaleString('tr-TR')
            : '-'
        }</td>
      </tr>
      <tr>
        <td class="info-label">Sonraki Randevu</td>
        <td class="info-value">${
          trial.next_meet_at
            ? new Date(trial.next_meet_at).toLocaleString('tr-TR')
            : '-'
        }</td>
      </tr>
    </table>

    <div class="section-title">Teklif Edilen Cihazlar</div>
    <table class="offer-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Marka</th>
          <th>Model</th>
          <th>Kulak</th>
          <th>Toplam Teklif</th>
        </tr>
      </thead>
      <tbody>
        ${deviceRowsHtml || '<tr><td colspan="5">Kayıtlı cihaz satırı bulunmuyor.</td></tr>'}
      </tbody>
    </table>

    <div class="totals">
      Toplam Teklif: ${formatPrice(totalQuoted)}
    </div>

    <div class="notes">
      Notlar:
      <div class="notes-box">
        <!-- Bu alan el ile doldurulabilir -->
      </div>
    </div>

    <div class="signature-row">
      <div class="signature-box">
        <div>Hasta / Veli</div>
        <div class="signature-line"></div>
      </div>
      <div class="signature-box">
        <div>Çözüm İşitme Yetkilisi</div>
        <div class="signature-line"></div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>
`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
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
            disabled={devices.length === 0}
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

            {!isDevicesLoading && !isDevicesError && devices.length === 0 && (
              <p className="text-xs text-slate-500">
                Bu deneme için kayıtlı cihaz satırı bulunmuyor.
              </p>
            )}

            {!isDevicesLoading && !isDevicesError && devices.length > 0 && (
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
                        Toplam Teklif
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((d, index) => (
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

                <div className="flex justify-end text-[11px] font-semibold text-slate-700">
                  Toplam teklif: {formatPrice(totalQuoted)}
                </div>
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
