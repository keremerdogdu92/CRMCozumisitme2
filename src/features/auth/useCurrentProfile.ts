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
 * Map the raw role value from the database into a safe UserRole union.
 */
function mapRole(rawRole: unknown): UserRole {
  if (rawRole === 'admin' || rawRole === 'staff') {
    return rawRole;
  }
  return 'unknown';
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

  // NOTE:
  // Current `profiles` schema has: id, org_id, role, created_at
  // There is no `full_name` column, so we only select existing fields.
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, org_id, role')
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
    role: mapRole(data.role),
    // Profiles table currently does not store a full_name field.
    full_name: null,
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
