// src/providers/AppProviders.tsx

import { PropsWithChildren, useEffect } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { supabaseClient } from '../utils/supabaseClient';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

// TODO: Buraya orgs tablosundan dönen gerçek org uuid'sini yaz
// örnek: '0f2e5c8a-1234-5678-9abc-def012345678'
const ORG_ID = 'REPLACE_WITH_ORG_UUID';

/**
 * Root-level providers for the application.
 * - Wraps the app in ThemeProvider
 * - Provides React Query client
 * - Ensures each authenticated user has a user_metadata.org_id set to ORG_ID (uuid)
 */
export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    const ensureOrgId = async () => {
      const { data, error } = await supabaseClient.auth.getUser();

      if (error) {
        console.error('Failed to get current user for org_id check:', error);
        return;
      }

      const user = data.user;
      if (!user) return;

      const currentOrgId =
        (user.user_metadata as Record<string, unknown> | null)?.org_id;

      // Sadece farklıysa güncelle
      if (currentOrgId !== ORG_ID) {
        const { error: updateError } = await supabaseClient.auth.updateUser({
          data: { org_id: ORG_ID },
        });

        if (updateError) {
          console.error('Failed to set org_id on user_metadata:', updateError);
        } else {
          console.log('user_metadata.org_id updated to ORG_ID');
        }
      }
    };

    void ensureOrgId();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}
