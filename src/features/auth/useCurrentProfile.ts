// src/features/auth/useCurrentProfile.ts
// React Query hook to load the current user's profile (role, org_id, etc.).

import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';

export type UserRole = 'admin' | 'staff' | 'unknown';

export interface CurrentProfile {
  id: string;
  org_id: string | null;
  role: UserRole;
  full_name: string | null;
}

/**
 * Fetch the current authenticated user's profile row from `profiles`.
 * Assumes there is exactly one row per user id.
 */
async function fetchCurrentProfile(): Promise<CurrentProfile | null> {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();

  if (userError) {
    console.error('AUTH_PROFILE_STEP_USER:', userError);
    throw new Error('AUTH_PROFILE_STEP_USER: ' + userError.message);
  }

  const user = userData.user;
  if (!user) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, org_id, role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('AUTH_PROFILE_STEP_PROFILE:', error);
    throw new Error('AUTH_PROFILE_STEP_PROFILE: ' + error.message);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id as string,
    org_id: (data.org_id as string | null) ?? null,
    role: (data.role as UserRole | null) ?? 'unknown',
    full_name: (data.full_name as string | null) ?? null,
  };
}

/**
 * useCurrentProfile:
 * - Returns the current profile row (or null if no user / no profile).
 * - Use profile.role to branch UI as admin vs staff.
 */
export function useCurrentProfile() {
  return useQuery({
    queryKey: ['current-profile'],
    queryFn: fetchCurrentProfile,
  });
}
