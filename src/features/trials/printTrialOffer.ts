// src/features/trials/printTrialOffer.ts
// Summary: Opens a new window and prints trial hearing aid offer using HTML template.

import type { TrialRow, TrialDeviceRow } from './types';
import type { OrgSettings } from '../settings/orgSettingsTypes';
import {
  buildTrialOfferHtml,
  type TrialOfferTemplateOptions,
} from './trialOfferTemplate';

export type PrintOptions = TrialOfferTemplateOptions;

export function openTrialOfferPrint(
  trial: TrialRow,
  devices: TrialDeviceRow[],
  orgSettings?: OrgSettings | null,
  options?: PrintOptions,
): void {
  const printWindow = window.open('', '_blank', 'width=800,height=1000');
  if (!printWindow) return;

  const html = buildTrialOfferHtml(trial, devices, orgSettings, options);

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Print on load (injected into the template is also ok, ama burada da tetikliyoruz)
  printWindow.onload = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      // Sessiz fail; kullanıcı isterse manuel yazdırabilir
    }
  };
}
