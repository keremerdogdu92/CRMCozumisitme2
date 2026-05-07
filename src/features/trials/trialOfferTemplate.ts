// src/features/trials/trialOfferTemplate.ts
// Summary: Pure HTML template builder for trial hearing aid offer print (A4).

import type { TrialRow, TrialDeviceRow } from './types';
import type { OrgSettings } from '../settings/orgSettingsTypes';

export type TrialOfferTemplateOptions = {
  includeDeviceDetails?: boolean;
};

function formatPriceForPrint(amount: number | null | undefined): string {
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMultilineTextForPrint(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  return escapeHtml(trimmed).replace(/\r?\n/g, '<br />');
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '';
  const parts = name
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (
    parts[0].charAt(0).toUpperCase() +
    parts[parts.length - 1].charAt(0).toUpperCase()
  );
}

// Human-readable ear side for print
function formatSideForPrint(side: string | null | undefined): string {
  if (!side) return '-';
  if (side === 'both') return 'Çift';
  return side;
}

// List price is per device; for bilateral ("both") we print 2x
function getTotalListPriceForSide(
  listPrice: number | null | undefined,
  side: string | null | undefined,
): number | null {
  if (listPrice == null || Number.isNaN(listPrice as number)) return null;
  const n = typeof listPrice === 'number' ? listPrice : Number(listPrice);
  if (!Number.isFinite(n)) return null;
  return side === 'both' ? n * 2 : n;
}

export function buildTrialOfferHtml(
  trial: TrialRow,
  devices: TrialDeviceRow[],
  orgSettings?: OrgSettings | null,
  options?: TrialOfferTemplateOptions,
): string {
  const includeDetails = options?.includeDeviceDetails ?? true;

  const companyName =
    orgSettings?.companyName ?? 'Çözüm İşitme Merkezi';
  const companyTagline =
    orgSettings?.companyTagline ?? 'İşitme Cihazları ve İşitme Sağlığı';
  const companyPhone = orgSettings?.phone ?? '0 (xxx) xxx xx xx';
  const companyAddress =
    orgSettings?.address ?? 'Adres bilgisi buraya gelecek';
  const companyWebsite = orgSettings?.website ?? 'www.ornek-site.com';
  const watermarkText =
    orgSettings?.offerWatermark ?? 'İşitme Cihazı Teklifi';
  const logoUrl = orgSettings?.logoUrl ?? null;
  const logoInitials = getInitials(companyName) || 'İÇ';
  const offerNoteHtml = formatMultilineTextForPrint(trial.offer_note);

  const deviceRowsHtml = devices
    .map((d, index) => {
      const sideLabel = formatSideForPrint(d.side ?? null);
      const totalListPrice = getTotalListPriceForSide(
        (d as any).list_price ?? null,
        d.side ?? null,
      );

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${d.brand ?? ''}</td>
          <td>${d.model ?? ''}</td>
          <td>${sideLabel}</td>
          <td style="text-align:right;">${formatPriceForPrint(totalListPrice)}</td>
          <td style="text-align:right;">${formatPriceForPrint(d.quote_price)}</td>
        </tr>
      `;
    })
    .join('');

  let deviceDetailsHtml = '';

  if (includeDetails && devices.length > 0) {
    const detailBlocks = devices
      .map((d, idx) => {
        const sideLabel = formatSideForPrint(d.side ?? null);
        const totalListPrice = getTotalListPriceForSide(
          (d as any).list_price ?? null,
          d.side ?? null,
        );
        const listPriceText = formatPriceForPrint(totalListPrice);
        const quotePriceText = formatPriceForPrint(d.quote_price);
        const technicalDetails =
          (d as any).details ?? (d as any).technical_details ?? null;
        const batteryType = (d as any).battery_type ?? null;

        return `
          <div class="device-detail-block">
            <div class="device-detail-header">
              <span class="device-detail-index">${idx + 1}.</span>
              <span class="device-detail-title">${
                d.brand ?? '-'
              } ${d.model ?? ''}</span>
            </div>
            <div class="device-detail-body">
              <div><span class="label">Kulak:</span> ${sideLabel}</div>
              <div><span class="label">Liste Fiyatı:</span> ${listPriceText}</div>
              <div><span class="label">Teklif Edilen Fiyat:</span> ${quotePriceText}</div>
              ${
                batteryType
                  ? `<div><span class="label">Pil Türü:</span> ${batteryType}</div>`
                  : ''
              }
              ${
                technicalDetails
                  ? `<div><span class="label">Teknik Özellikler:</span> ${technicalDetails}</div>`
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');

    deviceDetailsHtml = `
      <div class="section-title">Cihaz Detayları</div>
      <div class="device-details-wrapper">
        ${detailBlocks}
      </div>
    `;
  }

  const now = new Date();
  const issueDate = now.toLocaleDateString('tr-TR');
  const issueTime = now.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const logoHtml = logoUrl
    ? `<div class="logo-wrapper"><img src="${logoUrl}" alt="${companyName} logo" class="logo-img" /></div>`
    : `<div class="logo-box">${logoInitials}</div>`;

  // Watermark: logo varsa büyük, saydam logo; yoksa metin.
  const watermarkHtml = logoUrl
    ? `<div class="watermark watermark-image" style="background-image:url('${logoUrl}');"></div>`
    : `<div class="watermark">${watermarkText}</div>`;

  return `
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
    .watermark-image {
      font-size: 0;
      color: transparent;
      background-repeat: no-repeat;
      background-position: center;
      background-size: 65%;
      opacity: 0.18;
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
      gap: 10px;
    }
    .logo-box {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 16px;
    }
    .logo-wrapper {
      width: 60px;
      height: 60px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
    }
    .logo-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .company-name {
      font-size: 14px;
      font-weight: 600;
    }
    .company-subtitle {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
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
      line-height: 1.5;
      white-space: normal;
    }
    .notes-placeholder {
      color: #9ca3af;
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
    .device-details-wrapper {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px;
      margin-top: 4px;
      font-size: 11px;
    }
    .device-detail-block + .device-detail-block {
      border-top: 1px dashed #e5e7eb;
      margin-top: 6px;
      padding-top: 6px;
    }
    .device-detail-header {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 2px;
    }
    .device-detail-index {
      font-weight: 600;
      color: #4b5563;
    }
    .device-detail-title {
      font-weight: 600;
      color: #111827;
    }
    .device-detail-body .label {
      color: #6b7280;
      font-weight: 500;
      margin-right: 4px;
    }
  </style>
</head>
<body>
  ${watermarkHtml}
  <div class="page">
    <div class="header">
      <div class="company">
        ${logoHtml}
        <div>
          <div class="company-name">${companyName}</div>
          <div class="company-subtitle">${companyTagline}</div>
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
          <th>Liste Fiyatı</th>
          <th>Teklif (Satır)</th>
        </tr>
      </thead>
      <tbody>
        ${
          deviceRowsHtml ||
          '<tr><td colspan="6">Kayıtlı cihaz satırı bulunmuyor.</td></tr>'
        }
      </tbody>
    </table>

    ${deviceDetailsHtml}

    <div class="notes">
      Notlar:
      <div class="notes-box">
        ${
          offerNoteHtml ||
          '<span class="notes-placeholder">Bu alan el ile doldurulabilir.</span>'
        }
      </div>
    </div>

    <div class="signature-row">
      <div class="signature-box">
        <div>Hasta / Veli</div>
        <div class="signature-line"></div>
      </div>
      <div class="signature-box">
        <div>${companyName} Yetkilisi</div>
        <div class="signature-line"></div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-left">
        ${
          logoUrl
            ? `<div class="logo-wrapper"><img src="${logoUrl}" alt="${companyName} logo" class="logo-img" /></div>`
            : `<div class="logo-box">${logoInitials}</div>`
        }
        <div>
          <div class="footer-name">${companyName}</div>
          <div class="footer-meta">Yetkili İşitme Cihazı Satış ve Uygulama Merkezi</div>
        </div>
      </div>
      <div class="footer-right">
        <div>Telefon: ${companyPhone || '-'}</div>
        <div>Adres: ${companyAddress || '-'}</div>
        <div>Web: ${companyWebsite || '-'}</div>
      </div>
    </div>
  </div>
</body>
</html>
`;
}
