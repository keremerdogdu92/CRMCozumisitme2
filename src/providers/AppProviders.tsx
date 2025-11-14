// src/providers/AppProviders.tsx

import { PropsWithChildren, useEffect } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { supabaseClient } from '../utils/supabaseClient';

/**
 * Root-level providers for the application.
 * - Wraps the app in ThemeProvider
 * - Ensures each authenticated user has a user_metadata.org_id set
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

      if (!currentOrgId) {
        const { error: updateError } = await supabaseClient.auth.updateUser({
          data: { org_id: 'cozum_isitme' }, // istersen buradaki org id'yi değiştirebilirsin
        });

        if (updateError) {
          console.error('Failed to set org_id on user_metadata:', updateError);
        } else {
          console.log('org_id set to cozum_isitme on user_metadata');
        }
      }
    };

    void ensureOrgId();
  }, []);

  return <ThemeProvider>{children}</ThemeProvider>;
}
