// src/components/navigation/Topbar.tsx
// Top navigation bar with brand, greeting and logout.
// v2 – Accepts onMenuClick for mobile sidebar toggle.

import { Menu } from 'lucide-react';
import { supabaseClient } from '../../utils/supabaseClient';
import { useNavigate } from 'react-router-dom';

type TopbarProps = {
  onMenuClick?: () => void;
};

export function Topbar({ onMenuClick }: TopbarProps) {
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
        {/* Mobile menu button */}
        <button
          type="button"
          className="rounded-md p-1 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 lg:hidden"
          onClick={onMenuClick}
          aria-label="Menüyü aç"
          aria-expanded={Boolean(onMenuClick)}
        >
          <Menu className="h-6 w-6" />
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
          className="text-sm font-medium text-red-600 transition hover:underline"
        >
          Çıkış Yap
        </button>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500 text-sm font-semibold text-white">
          A
        </div>
      </div>
    </header>
  );
}
