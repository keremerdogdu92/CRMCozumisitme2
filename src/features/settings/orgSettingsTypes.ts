// src/features/settings/orgSettingsTypes.ts
// Summary: Shared types for per-organization settings (branding + offer print).

export type OrgSettings = {
  orgId: string;
  companyName: string;
  companyTagline: string;
  phone: string;
  address: string;
  website: string;
  logoUrl: string | null;
  offerWatermark: string;
  themePreset: 'cozum' | 'navy' | 'graphite';
};
