// src/features/trials/printTrialOffer.ts
// Helper for rendering and printing a trial hearing aid offer as an A4 page.

import type { TrialRow, TrialDeviceRow } from './types';

function formatPriceForPrint(amount: number | null | undefined): string {
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

export function openTrialOfferPrint(trial: TrialRow, devices: TrialDeviceRow[]): void {
  const printWindow = window.open('', '_blank', 'width=800,height=1000');
  if (!printWindow) return;

  const deviceRowsHtml = devices
    .map((d, index) => {
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${d.brand ?? ''}</td>
          <td>${d.model ?? ''}</td>
          <td>${d.side ?? ''}</td>
          <td style="text-align:right;">${formatPriceForPrint(d.quote_price)}</td>
        </tr>
      `;
    })
    .join('');

  const now = new Date();
  const issueDate = now.toLocaleDateString('tr-TR');
  const issueTime = now.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const html = `
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>İşitme Cihazı Teklifi - ${trial.full_name ?? ''}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      font-size: 12px;
      color: #111827;
      margin: 0;
      padding: 0;
      position: relative;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 72px;
      font-weight: 700;
      color: rgba(148, 163, 184, 0.15);
      pointer-events: none;
      z-index: 0;
      text-align: center;
      white-space: nowrap;
    }
    .page {
      padding: 0;
      position: relative;
      z-index: 1;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .company {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo-box {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
    }
    .company-name {
      font-size: 13px;
      font-weight: 600;
    }
    .company-subtitle {
      font-size: 11px;
      color: #6b7280;
    }
    .title-block {
      text-align: right;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
    }
    .subtitle {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
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
    .footer {
      margin-top: 24px;
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #374151;
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .footer-name {
      font-weight: 600;
      font-size: 11px;
    }
    .footer-meta {
      font-size: 10px;
      color: #6b7280;
    }
    .footer-right {
      text-align: right;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="watermark">Çözüm İşitme Merkezi</div>
  <div class="page">
    <div class="header">
      <div class="company">
        <div class="logo-box">Çİ</div>
        <div>
          <div class="company-name">Çözüm İşitme Merkezi</div>
          <div class="company-subtitle">İşitme Cihazları ve İşitme Sağlığı</div>
        </div>
      </div>
      <div class="title-block">
        <div class="title">İşitme Cihazı Teklifi</div>
        <div class="subtitle">
          Teklif Tarihi: ${issueDate} ${issueTime}
        </div>
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
          <th>Teklif (Satır)</th>
        </tr>
      </thead>
      <tbody>
        ${deviceRowsHtml || '<tr><td colspan="5">Kayıtlı cihaz satırı bulunmuyor.</td></tr>'}
      </tbody>
    </table>

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

    <div class="footer">
      <div class="footer-left">
        <div class="logo-box">Çİ</div>
        <div>
          <div class="footer-name">Çözüm İşitme Merkezi</div>
          <div class="footer-meta">Yetkili İşitme Cihazı Satış ve Uygulama Merkezi</div>
        </div>
      </div>
      <div class="footer-right">
        <div>Telefon: 0 (xxx) xxx xx xx</div>
        <div>Adres: Adres bilgisi buraya gelecek</div>
        <div>Web: www.ornek-site.com</div>
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
}
