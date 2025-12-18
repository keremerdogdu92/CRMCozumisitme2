// src/features/settings/useOrgSettings.ts
// Hook + fetcher for per-organization settings from `org_settings` table.

import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import { useCurrentProfile } from '../auth/useCurrentProfile';
import type { OrgSettings } from './orgSettingsTypes';

export const ORG_SETTINGS_QUERY_KEY = (orgId: string | null) => [
  'org-settings',
  orgId,
];

async function fetchOrgSettings(orgId: string): Promise<OrgSettings> {
  const { data, error } = await supabaseClient
    .from('org_settings')
    .select(
      'org_id, company_name, company_tagline, phone, address, website, logo_url, offer_watermark',
    )
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) {
    console.error('ORG_SETTINGS_FETCH_ERROR:', error);
    throw new Error('Org settings could not be loaded');
  }

  // Defaults if row missing yet
  if (!data) {
    return {
      orgId,
      companyName: 'Çözüm İşitme Merkezi',
      companyTagline: 'İşitme Cihazları ve İşitme Sağlığı',
      phone: '',
      address: '',
      website: '',
      logoUrl: null,
      offerWatermark: 'İşitme Cihazı Teklifi',
    };
  }

  return {
    orgId: data.org_id as string,
    companyName:
      (data.company_name as string | null) ?? 'Çözüm İşitme Merkezi',
    companyTagline:
      (data.company_tagline as string | null) ??
      'İşitme Cihazları ve İşitme Sağlığı',
    phone: (data.phone as string | null) ?? '',
    address: (data.address as string | null) ?? '',
    website: (data.website as string | null) ?? '',
    logoUrl: (data.logo_url as string | null) ?? null,
    offerWatermark:
      (data.offer_watermark as string | null) ?? 'İşitme Cihazı Teklifi',
  };
}

/**
 * useOrgSettings:
 * - Uses current profile's org_id.
 * - Returns normalized OrgSettings (with safe defaults) for UI and printing.
 */
export function useOrgSettings() {
  const { data: profile } = useCurrentProfile();
  const orgId = profile?.org_id ?? null;

  return useQuery<OrgSettings>({
    queryKey: ORG_SETTINGS_QUERY_KEY(orgId),
    enabled: !!orgId,
    queryFn: () => fetchOrgSettings(orgId as string),
  });
}
