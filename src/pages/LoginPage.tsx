// src/pages/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseClient } from '../utils/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) {
      setErr('Giriş yapılamadı. Mail veya şifre hatalı.');
      setLoading(false);
      return;
    }

    setLoading(false);
    // SPA içi yönlendirme
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
      <form
        onSubmit={handleLogin}
        className="bg-white shadow-lg rounded-lg p-8 w-full max-w-sm"
      >
        <h1 className="text-xl font-semibold mb-4 text-gray-700">
          CRM Giriş
        </h1>

        {err && <p className="mb-3 text-red-600 text-sm">{err}</p>}

        <label className="block mb-3">
          <span className="text-sm text-gray-600">E-posta</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border px-3 py-2 rounded"
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm text-gray-600">Şifre</span>
          <input
            type="password"
            required
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="mt-1 w-full border px-3 py-2 rounded"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
        </button>
      </form>
    </div>
  );
}
