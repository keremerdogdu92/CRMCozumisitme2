// src/providers/AppProviders.tsx
// Summary: Root-level providers for the application.
// - Provides React Query client
// - Provides ThemeProvider
// - Invalidates auth-dependent queries when auth state changes
//
// v2.0:
// - Removes the hardcoded ORG_ID user_metadata hack.
// - Listens to Supabase auth state changes and invalidates auth/profile/org queries.

import { PropsWithChildren, useEffect } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { supabaseClient } from '../utils/supabaseClient';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

/**
 * AppProviders:
 * - Wraps the app in ThemeProvider + React Query.
 * - Listens to auth state changes to refresh queries that depend on session/user.
 */
export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    const { data: sub } = supabaseClient.auth.onAuthStateChange(
      (_event, _session) => {
        // Auth state changed → refresh anything that depends on auth/profile/org
        void queryClient.invalidateQueries({ queryKey: ['current-profile'] });
        // If you have other org-scoped keys, invalidate them here as well.
        // Example patterns (optional):
        // void queryClient.invalidateQueries({ queryKey: ['org-settings'] });
        // void queryClient.invalidateQueries({ queryKey: ['patients'] });
      },
    );

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}
