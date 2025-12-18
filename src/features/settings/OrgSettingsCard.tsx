// src/features/settings/OrgSettingsCard.tsx
// Summary: Settings card for organization branding and offer print info.

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import { useOrgSettings, ORG_SETTINGS_QUERY_KEY } from './useOrgSettings';
import type { OrgSettings } from './orgSettingsTypes';
import { useCurrentProfile } from '../auth/useCurrentProfile';

type FormState = {
  companyName: string;
  companyTagline: string;
  phone: string;
  address: string;
  website: string;
  logoUrl: string;
  offerWatermark: string;
};

function createInitialForm(settings: OrgSettings | undefined): FormState {
  return {
    companyName: settings?.companyName ?? '',
    companyTagline: settings?.companyTagline ?? '',
    phone: settings?.phone ?? '',
    address: settings?.address ?? '',
    website: settings?.website ?? '',
    logoUrl: settings?.logoUrl ?? '',
    offerWatermark: settings?.offerWatermark ?? '',
  };
}

export function OrgSettingsCard() {
  const { data: profile } = useCurrentProfile();
  const orgId = profile?.org_id ?? null;

  const { data: settings, isLoading, isError } = useOrgSettings();
  const [form, setForm] = useState<FormState>(() =>
    createInitialForm(undefined),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Sync form when settings first load
  useEffect(() => {
    if (settings) {
      setForm(createInitialForm(settings));
      setSaveMessage(null);
    }
  }, [settings]);

  if (!orgId) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">
          Organization Settings
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Oturumda geçerli bir organizasyon bulunamadı. Lütfen tekrar giriş
          yapın veya sistem yöneticinize başvurun.
        </p>
      </section>
    );
  }

  const handleChange = (
    field: keyof FormState,
    value: string,
  ): void => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSaveMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const payload = {
        org_id: orgId,
        company_name: form.companyName.trim() || 'Çözüm İşitme Merkezi',
        company_tagline:
          form.companyTagline.trim() || 'İşitme Cihazları ve İşitme Sağlığı',
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        website: form.website.trim() || null,
        logo_url: form.logoUrl.trim() || null,
        offer_watermark:
          form.offerWatermark.trim() || 'İşitme Cihazı Teklifi',
      };

      const { error } = await supabaseClient
        .from('org_settings')
        .upsert(payload, {
          onConflict: 'org_id',
        });

      if (error) {
        console.error('ORG_SETTINGS_SAVE_ERROR:', error);
        setSaveMessage('Kaydetme sırasında bir hata oluştu.');
      } else {
        await queryClient.invalidateQueries({
          queryKey: ORG_SETTINGS_QUERY_KEY(orgId),
        });
        setSaveMessage('Ayarlar kaydedildi.');
      }
    } catch (err) {
      console.error('ORG_SETTINGS_SAVE_EXCEPTION:', err);
      setSaveMessage('Beklenmeyen bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Organization / Teklif Ayarları
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Deneme teklif çıktılarında kullanılacak firma adı, logo URL&apos;i
            ve iletişim bilgilerini burada tanımlayın.
          </p>
        </div>
      </div>

      {isLoading && (
        <p className="text-xs text-slate-500">
          Ayarlar yükleniyor...
        </p>
      )}

      {isError && (
        <p className="text-xs text-red-600">
          Ayarlar alınırken bir hata oluştu. Lütfen sayfayı yenileyin.
        </p>
      )}

      {!isLoading && !isError && (
        <form
          className="grid gap-3 text-xs md:grid-cols-2"
          onSubmit={handleSubmit}
        >
          <div className="space-y-1">
            <label className="block font-medium text-slate-700">
              Firma Adı
            </label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) =>
                handleChange('companyName', e.target.value)
              }
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Örn: Çözüm İşitme Merkezi"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-medium text-slate-700">
              Slogan / Alt Başlık
            </label>
            <input
              type="text"
              value={form.companyTagline}
              onChange={(e) =>
                handleChange('companyTagline', e.target.value)
              }
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Örn: İşitme Cihazları ve İşitme Sağlığı"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-medium text-slate-700">
              Telefon
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="0 (xxx) xxx xx xx"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-medium text-slate-700">
              Web Adresi
            </label>
            <input
              type="text"
              value={form.website}
              onChange={(e) =>
                handleChange('website', e.target.value)
              }
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="www.ornek-site.com"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block font-medium text-slate-700">
              Adres
            </label>
            <textarea
              value={form.address}
              onChange={(e) =>
                handleChange('address', e.target.value)
              }
              rows={2}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Adres bilgisi"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-medium text-slate-700">
              Logo URL
            </label>
            <input
              type="text"
              value={form.logoUrl}
              onChange={(e) => handleChange('logoUrl', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="https://.../logo.png"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Şimdilik yalnızca URL destekleniyor. İleride dosya upload ile
              entegre edilebilir.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block font-medium text-slate-700">
              Watermark Metni
            </label>
            <input
              type="text"
              value={form.offerWatermark}
              onChange={(e) =>
                handleChange('offerWatermark', e.target.value)
              }
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="İşitme Cihazı Teklifi"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-between pt-2">
            <div className="text-[11px] text-slate-500">
              Bu bilgiler deneme hastası teklif çıktısının üst kısmında ve
              alt bilgi alanında kullanılır.
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>

          {saveMessage && (
            <p className="md:col-span-2 text-[11px] text-slate-600">
              {saveMessage}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
