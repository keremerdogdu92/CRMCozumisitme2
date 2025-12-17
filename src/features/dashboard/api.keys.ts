// src/features/dashboard/api.keys.ts
// React Query keys for the Dashboard feature.

export const DASHBOARD_QUERY_KEY = (monthStartIso: string | null) =>
  ['dashboard', monthStartIso ?? 'current-month'] as const;
