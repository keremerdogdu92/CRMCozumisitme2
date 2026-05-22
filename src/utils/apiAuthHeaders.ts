import { supabaseClient } from './supabaseClient';

export async function getAuthenticatedJsonHeaders(): Promise<HeadersInit> {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    throw new Error('Oturum bilgisi okunamadı: ' + error.message);
  }

  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}
