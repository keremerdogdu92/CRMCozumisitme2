// src/pages/ForgotPasswordPage.tsx
// Summary: Sends a password reset email using Supabase recovery flow.
// Debug additions:
// - Logs Supabase error details (code, message, status, name)
// - Logs redirectTo and email
// - Optional debug block for development (console-first, UI-safe)

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabaseClient } from '../utils/supabaseClient';

type DebugError = {
  name?: string;
  message?: string;
  status?: number;
  code?: string;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const [err, setErr] = useState('');
  const [debugError, setDebugError] = useState<DebugError | null>(null);

  const redirectTo = useMemo(() => {
    return `${window.location.origin}/reset-password`;
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setDebugError(null);
    setStatus('sending');

    const trimmed = email.trim();
    if (!trimmed) {
      setErr('Lütfen e-posta adresinizi girin.');
      setStatus('error');
      return;
    }

    console.group('[AUTH][FORGOT_PASSWORD]');
    console.info('Email:', trimmed);
    console.info('RedirectTo:', redirectTo);

    const { error } = await supabaseClient.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });

    if (error) {
      const detailed: DebugError = {
        name: (error as any).name,
        message: error.message,
        status: (error as any).status,
        code: (error as any).code,
      };

      console.error('Supabase resetPasswordForEmail error:', detailed);
      console.groupEnd();

      setDebugError(detailed);
      setErr(
        'Şifre sıfırlama e-postası gönderilemedi. Lütfen e-posta adresinizi kontrol edin.',
      );
      setStatus('error');
      return;
    }

    console.info('Password recovery email request accepted');
    console.groupEnd();
    setStatus('sent');
  };

  const isDev = import.meta.env.DEV;

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

            {/* DEV-ONLY DEBUG BLOCK */}
            {isDev && debugError && (
              <pre className="text-xs bg-slate-900 text-slate-100 rounded p-2 overflow-auto">
{JSON.stringify(debugError, null, 2)}
              </pre>
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
