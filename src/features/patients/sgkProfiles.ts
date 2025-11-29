// src/features/patients/sgkProfiles.ts
// Static SGK profile definitions for hearing-aid reimbursements.
// These can later be moved to a Supabase table. For now we keep
// them versioned with a validFrom date.

export type SgkProfileId =
  | 'SGK_0_4_CALISAN'
  | 'SGK_0_4_EMEKLI'
  | 'SGK_5_12_CALISAN'
  | 'SGK_5_12_EMEKLI'
  | 'SGK_13_18_CALISAN'
  | 'SGK_13_18_EMEKLI'
  | 'SGK_YETISKIN_CALISAN'
  | 'SGK_YETISKIN_EMEKLI';

export type SgkProfileDefinition = {
  id: SgkProfileId;
  label: string;
  gross: number;          // SGK'nın karşıladığı brüt tutar
  netToFirm: number;      // Firmaya SGK tarafından ödenecek net tutar (3. sütun)
  employeeShare?: number; // Çalışan katılım payı (varsa)
  retireeShare?: number;  // Emekli katılım payı (varsa)
  retireeNetAfterShare?: number; // Emekli için fiili ödeme (varsa)
  validFrom: string;      // "2024-08-13" – resmi tablodaki tarih
};

export const SGK_PROFILES: SgkProfileDefinition[] = [
  {
    id: 'SGK_0_4_CALISAN',
    label: 'SGK 0–4 yaş çalışan',
    gross: 7630.56,
    netToFirm: 6104.448,
    employeeShare: 1526.112,
    validFrom: '2024-08-13',
  },
  {
    id: 'SGK_0_4_EMEKLI',
    label: 'SGK 0–4 yaş emekli',
    gross: 7630.56,
    netToFirm: 7630.56,
    retireeShare: 763.056,
    retireeNetAfterShare: 6867.504,
    validFrom: '2024-08-13',
  },
  {
    id: 'SGK_5_12_CALISAN',
    label: 'SGK 5–12 yaş çalışan',
    gross: 6782.72,
    netToFirm: 5426.176,
    employeeShare: 1356.544,
    validFrom: '2024-08-13',
  },
  {
    id: 'SGK_5_12_EMEKLI',
    label: 'SGK 5–12 yaş emekli',
    gross: 6782.72,
    netToFirm: 6782.72,
    retireeShare: 678.272,
    retireeNetAfterShare: 6104.448,
    validFrom: '2024-08-13',
  },
  {
    id: 'SGK_13_18_CALISAN',
    label: 'SGK 13–18 yaş çalışan',
    gross: 6358.8,
    netToFirm: 5087.04,
    employeeShare: 1271.76,
    validFrom: '2024-08-13',
  },
  {
    id: 'SGK_13_18_EMEKLI',
    label: 'SGK 13–18 yaş emekli',
    gross: 6358.8,
    netToFirm: 6358.8,
    retireeShare: 635.88,
    retireeNetAfterShare: 5722.92,
    validFrom: '2024-08-13',
  },
  {
    id: 'SGK_YETISKIN_CALISAN',
    label: 'SGK yetişkin çalışan',
    gross: 4239.2,
    netToFirm: 3391.36,
    employeeShare: 847.84,
    validFrom: '2024-08-13',
  },
  {
    id: 'SGK_YETISKIN_EMEKLI',
    label: 'SGK yetişkin emekli',
    gross: 4239.2,
    netToFirm: 4239.2,
    retireeShare: 423.92,
    retireeNetAfterShare: 3815.28,
    validFrom: '2024-08-13',
  },
];

/**
 * Helper to get the label for a stored sgk_profile code.
 * Falls back to the raw code if no match is found.
 */
export function getSgkProfileLabel(
  profileId: string | null | undefined,
): string {
  if (!profileId) return '-';
  const profile = SGK_PROFILES.find((p) => p.id === profileId);
  return profile ? profile.label : profileId;
}
