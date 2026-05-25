export type ThemePresetId = 'cozum' | 'navy' | 'graphite';

export type ThemePreset = {
  id: ThemePresetId;
  label: string;
  description: string;
  swatches: string[];
};

export const DEFAULT_THEME_PRESET: ThemePresetId = 'cozum';

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'cozum',
    label: 'Cozum Logo',
    description: 'Lacivert ana renk, kontrollu kirmizi vurgu ve temiz beyaz yuzeyler.',
    swatches: ['#244f7f', '#ee1b2a', '#f8fafc'],
  },
  {
    id: 'navy',
    label: 'Sakin Mavi',
    description: 'Daha kurumsal mavi ton, kirmizi sadece kritik durumlarda kalir.',
    swatches: ['#1d4ed8', '#dc2626', '#f1f5f9'],
  },
  {
    id: 'graphite',
    label: 'Grafit',
    description: 'Koyu gri/lacivert ana renk, dusuk doygunluklu kirmizi vurgu.',
    swatches: ['#334155', '#b91c1c', '#f8fafc'],
  },
];

export function normalizeThemePreset(
  value: string | null | undefined,
): ThemePresetId {
  return value === 'navy' || value === 'graphite' || value === 'cozum'
    ? value
    : DEFAULT_THEME_PRESET;
}
