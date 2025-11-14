// src/components/navigation/Topbar.tsx

import { Menu } from 'lucide-react';
import { supabaseClient } from '../../utils/supabaseClient';
import { useNavigate } from 'react-router-dom';

export function Topbar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    supabaseClient.auth
      .signOut()
      .catch((err) => {
        console.error('Logout error:', err);
      })
      .finally(() => {
        // SPA içi yönlendirme, Vercel'de 404'a düşmez
        navigate('/login', { replace: true });
      });
  };

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <button type="button" className="lg:hidden">
          <Menu className="h-6 w-6 text-slate-600" />
          <span className="sr-only">Menüyü Aç</span>
        </button>
        <h1 className="text-lg font-semibold text-slate-900">
          Çözüm İşitme CRM
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-600">Hoş geldiniz</span>

        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-red-600 font-medium hover:underline transition"
        >
          Çıkış Yap
        </button>

        <div className="h-9 w-9 rounded-full bg-primary-500 text-sm font-semibold text-white flex items-center justify-center">
          A
        </div>
      </div>
    </header>
  );
}
