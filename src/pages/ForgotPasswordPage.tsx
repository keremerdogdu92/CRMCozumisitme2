// src/pages/ForgotPasswordPage.tsx
// Summary: Sends a password reset email using Supabase recovery flow.
// Notes:
// - The redirect URL must be allowed in Supabase Auth settings (Redirect URLs).
// - We redirect back to /reset-password where the user sets a new password.
// - Debug: When Supabase returns an error, log structured details (name/status/code/message)
//   to make SMTP/auth issues easier to diagnose.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabaseClient } from '../utils/supabaseClient';

type SendStatus = 'idle' | 'sending' | 'sent' | 'error';

type AuthErrorLike = {
  name?: string;
  message?: string;
  status?: number;
  code?: string;
  __isAuthError?: boolean;
};

function normalizeAuthError(err: unknown): AuthErrorLike {
  if (!err || typeof err !== 'object') {
    return { message: String(err ?? 'Unknown error') };
  }

  const anyErr = err as Record<string, unknown>;

  // Supabase JS often returns AuthApiError with: name, message, status, code
  const name =
    typeof anyErr.name === 'string' ? (anyErr.name as string) : undefined;
  const message =
    typeof anyErr.message === 'string'
      ? (anyErr.message as string)
      : undefined;
  const status =
    typeof anyErr.status === 'number'
      ? (anyErr.status as number)
      : undefined;

  // Some versions include "code" (string) or nested fields
  const code =
    typeof anyErr.code === 'string' ? (anyErr.code as string) : undefined;

  return { name, message, status, code };
}

function formatAuthErrorForConsole(e: AuthErrorLike) {
  return {
    name: e.name ?? null,
    status: e.status ?? null,
    code: e.code ?? null,
    message: e.message ?? null,
  };
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<SendStatus>('idle');
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
      const normalized = normalizeAuthError(error);

      // Console debug (safe for prod; does not expose secrets)
      console.error('AUTH_FORGOT_PASSWORD_SEND:', formatAuthErrorForConsole(normalized));
      console.error('AUTH_FORGOT_PASSWORD_SEND_RAW:', error);

      // User-facing message: keep simple (don’t leak internals)
      // But include a tiny hint if status exists.
      const statusHint =
        typeof normalized.status === 'number' ? ` (HTTP ${normalized.status})` : '';
      setErr(
        `Şifre sıfırlama e-postası gönderilemedi${statusHint}. Lütfen daha sonra tekrar deneyin.`,
      );

      setStatus('error');
      return;
    }

    // Important: Supabase may accept the request but the email can still land in spam
    // or be rejected by the SMTP provider. We can’t verify delivery from the client.
    setStatus('sent');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-2 text-gray-700">Şifre Sıfırlama</h1>
        <p className="text-sm text-slate-600 mb-4">
          E-posta adresinizi yazın. Şifre sıfırlama linki göndereceğiz.
        </p>

        {status === 'sent' ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            İstek alındı. E-posta birkaç dakika içinde gelebilir. Gelen kutusu + spam/önemsiz’i kontrol edin.
            <div className="mt-2 text-emerald-900/80">
              Gelmiyorsa: SMTP/DNS (SPF-DKIM) veya mail sunucusu teslim sorunları olabilir.
            </div>
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
