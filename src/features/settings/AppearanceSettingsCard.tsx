import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import { useCurrentProfile } from '../auth/useCurrentProfile';
import { ORG_SETTINGS_QUERY_KEY, useOrgSettings } from './useOrgSettings';
import {
  THEME_PRESETS,
  normalizeThemePreset,
  type ThemePresetId,
} from './themePresets';

export function AppearanceSettingsCard() {
  const { data: profile } = useCurrentProfile();
  const orgId = profile?.org_id ?? null;
  const { data: settings, isLoading } = useOrgSettings();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<ThemePresetId | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = normalizeThemePreset(settings?.themePreset);

  async function handleSelect(themePreset: ThemePresetId) {
    if (!orgId) return;
    setSaving(themePreset);
    setMessage(null);

    const { error } = await supabaseClient
      .from('org_settings')
      .upsert(
        {
          org_id: orgId,
          theme_preset: themePreset,
        },
        { onConflict: 'org_id' },
      );

    if (error) {
      setMessage('Tema kaydedilemedi. Supabase schema guncel mi kontrol edin.');
    } else {
      document.documentElement.dataset.theme = themePreset;
      localStorage.setItem('crm-theme-preset', themePreset);
      await queryClient.invalidateQueries({
        queryKey: ORG_SETTINGS_QUERY_KEY(orgId),
      });
      setMessage('Tema kaydedildi.');
    }

    setSaving(null);
  }

  return (
    <section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Gorunum</h3>
        <p className="mt-1 text-xs text-slate-600">
          Renkler hazir preset olarak degisir. Serbest renk secimi yok; bu
          sayede buton, tablo ve form okunabilirligi korunur.
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-500">Tema bilgisi yukleniyor...</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {THEME_PRESETS.map((preset) => {
            const isSelected = selected === preset.id;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelect(preset.id)}
                disabled={saving !== null}
                className={
                  'rounded-lg border p-3 text-left transition ' +
                  (isSelected
                    ? 'border-primary-500 bg-primary-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-primary-200 hover:bg-slate-50')
                }
              >
                <div className="mb-3 flex gap-1.5">
                  {preset.swatches.map((color) => (
                    <span
                      key={color}
                      className="h-6 w-6 rounded-full border border-white shadow-sm ring-1 ring-slate-200"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {preset.label}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {preset.description}
                </p>
                {isSelected && (
                  <p className="mt-2 text-[11px] font-medium text-primary-700">
                    Aktif tema
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {message && <p className="mt-3 text-xs text-slate-600">{message}</p>}
    </section>
  );
}
