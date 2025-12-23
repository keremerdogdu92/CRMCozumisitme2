// src/pages/ResetPasswordPage.tsx
// Summary: Completes Supabase password recovery by setting a new password.
// Behavior:
// - If user arrives with a valid recovery link, Supabase establishes a session.
// - We wait for a session, then call updateUser({ password }).
// - If there's no session, user is guided back to forgot-password.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabaseClient } from '../utils/supabaseClient';

type ReadyState = 'checking' | 'ready' | 'no-session';

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [readyState, setReadyState] = useState<ReadyState>('checking');
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let alive = true;

    const checkSession = async () => {
      const { data, error } = await supabaseClient.auth.getSession();
      if (!alive) return;

      if (error) {
        console.error('AUTH_RESET_SESSION_CHECK:', error);
        setReadyState('no-session');
        return;
      }

      if (data.session) {
        setReadyState('ready');
        return;
      }

      // If no session yet, subscribe to auth changes (recovery link can set it shortly after load)
      const { data: sub } = supabaseClient.auth.onAuthStateChange(
        (_event, session) => {
          if (!alive) return;
          if (session) {
            setReadyState('ready');
          }
        },
      );

      // Fallback: after short delay, decide no-session.
      window.setTimeout(() => {
        if (!alive) return;
        setReadyState((prev) => (prev === 'ready' ? 'ready' : 'no-session'));
        sub.subscription.unsubscribe();
      }, 1200);
    };

    void checkSession();

    return () => {
      alive = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setOk(false);

    const p1 = pass1.trim();
    const p2 = pass2.trim();

    if (p1.length < 8) {
      setErr('Şifre en az 8 karakter olmalı.');
      return;
    }
    if (p1 !== p2) {
      setErr('Şifreler eşleşmiyor.');
      return;
    }

    setSaving(true);

    const { error } = await supabaseClient.auth.updateUser({ password: p1 });

    if (error) {
      console.error('AUTH_RESET_PASSWORD_UPDATE:', error);
      setErr('Şifre güncellenemedi. Lütfen linki yeniden isteyin.');
      setSaving(false);
      return;
    }

    setOk(true);
    setSaving(false);

    // Optional: sign out after password change to ensure clean login.
    await supabaseClient.auth.signOut().catch(() => undefined);
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-2 text-gray-700">
          Yeni Şifre Belirle
        </h1>

        {readyState === 'checking' && (
          <p className="text-sm text-slate-600">Kontrol ediliyor...</p>
        )}

        {readyState === 'no-session' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Bu link geçersiz veya süresi dolmuş olabilir.
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Yeni link iste
            </Link>
            <div>
              <Link to="/login" className="text-xs text-slate-600 hover:underline">
                Giriş sayfasına dön
              </Link>
            </div>
          </div>
        )}

        {readyState === 'ready' && (
          <form onSubmit={handleSave} className="space-y-3">
            {err && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </p>
            )}
            {ok && (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Şifre güncellendi. Giriş sayfasına yönlendiriliyorsunuz...
              </p>
            )}

            <label className="block">
              <span className="text-sm text-gray-600">Yeni şifre</span>
              <input
                type="password"
                required
                value={pass1}
                onChange={(e) => setPass1(e.target.value)}
                className="mt-1 w-full border px-3 py-2 rounded"
                autoComplete="new-password"
              />
            </label>

            <label className="block">
              <span className="text-sm text-gray-600">Yeni şifre (tekrar)</span>
              <input
                type="password"
                required
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                className="mt-1 w-full border px-3 py-2 rounded"
                autoComplete="new-password"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-60"
            >
              {saving ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
            </button>

            <div className="flex justify-between text-xs">
              <Link to="/login" className="text-slate-600 hover:underline">
                Giriş sayfasına dön
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
