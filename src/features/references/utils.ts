// src/features/references/utils.ts
// Small helpers for references UI.

import type { ReferenceRow } from './types';

export function renderGroupLabel(group: ReferenceRow['group']): string {
  switch (group) {
    case 'medikal':
      return 'Medikal';
    case 'doktor':
      return 'Doktor';
    case 'odyolog':
      return 'Odyolog';
    case 'dernek':
      return 'Dernek';
    default:
      return '-';
  }
}
