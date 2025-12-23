// src/pages/ForgotPasswordPage.tsx
// Summary: Sends a password reset email using Supabase recovery flow.
// Notes:
// - The redirect URL must be allowed in Supabase Auth settings (Redirect URLs).
// - We redirect back to /reset-password where the user sets a new password.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabaseClient } from '../utils/supabaseClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const [err, setErr] = useState('');

  const redirectTo = useMemo(() => {
    // Ensures correct host on localhost / production.
    return `${window.location.origin}/reset-password`;
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setStatus('sending');

    const trimmed = email.trim();
    if (!trimmed) {
      setErr('Lütfen e-posta adresinizi girin.');
      setStatus('error');
      return;
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });

    if (error) {
      console.error('AUTH_FORGOT_PASSWORD_SEND:', error);
      setErr(
        'Şifre sıfırlama e-postası gönderilemedi. Lütfen e-posta adresinizi kontrol edin.',
      );
      setStatus('error');
      return;
    }

    setStatus('sent');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-2 text-gray-700">
          Şifre Sıfırlama
        </h1>
        <p className="text-sm text-slate-600 mb-4">
          E-posta adresinizi yazın. Şifre sıfırlama linki göndereceğiz.
        </p>

        {status === 'sent' ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            E-posta gönderildi. Gelen kutunuzu (ve spam klasörünü) kontrol edin.
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-3">
            {err && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </p>
            )}

            <label className="block">
              <span className="text-sm text-gray-600">E-posta</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full border px-3 py-2 rounded"
                autoComplete="email"
              />
            </label>

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-60"
            >
              {status === 'sending' ? 'Gönderiliyor...' : 'Sıfırlama Linki Gönder'}
            </button>
          </form>
        )}

        <div className="mt-4 flex justify-between text-xs">
          <Link to="/login" className="text-slate-600 hover:underline">
            Giriş sayfasına dön
          </Link>
        </div>
      </div>
    </div>
  );
}
