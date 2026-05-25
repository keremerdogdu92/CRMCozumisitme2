import { PropsWithChildren, useEffect } from 'react';
import { useOrgSettings } from '../features/settings/useOrgSettings';
import {
  DEFAULT_THEME_PRESET,
  normalizeThemePreset,
  type ThemePresetId,
} from '../features/settings/themePresets';

const STORAGE_KEY = 'crm-theme-preset';

function applyThemePreset(theme: ThemePresetId) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const { data: settings } = useOrgSettings();

  useEffect(() => {
    const stored = normalizeThemePreset(localStorage.getItem(STORAGE_KEY));
    applyThemePreset(stored ?? DEFAULT_THEME_PRESET);
  }, []);

  useEffect(() => {
    if (settings?.themePreset) {
      applyThemePreset(settings.themePreset);
    }
  }, [settings?.themePreset]);

  return children;
}
