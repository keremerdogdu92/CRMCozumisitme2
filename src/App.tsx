// src/App.tsx
import { Outlet, RouterProvider, createBrowserRouter, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AppProviders } from './providers/AppProviders';
import { AppShell } from './components/layout/AppShell';
import { LoadingScreen } from './components/status/LoadingScreen';
import { supabaseClient } from './utils/supabaseClient';
import { useEffect, useState } from 'react';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));

// ---------------------------
// Basit Auth Guard Component
// ---------------------------
function ProtectedRoute() {
  const [status, setStatus] = useState<'loading' | 'authed' | 'guest'>('loading');

  useEffect(() => {
    const run = async () => {
      const { data } = await supabaseClient.auth.getSession();
      if (data.session) setStatus('authed');
      else setStatus('guest');
    };
    run();
  }, []);

  if (status === 'loading') return <LoadingScreen />;

  if (status === 'guest') return <Navigate to="/login" replace />;

  return <Outlet />;
}

// -----------------------------
// Router yapılandırması
// -----------------------------
const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <AppProviders>
        <Suspense fallback={<LoadingScreen />}>
          <LoginPage />
        </Suspense>
      </AppProviders>
    )
  },

  {
    path: '/',
    element: (
      <AppProviders>
        <ProtectedRoute />
      </AppProviders>
    ),
    children: [
      {
        path: '/',
        element: (
          <AppShell>
            <Suspense fallback={<LoadingScreen />}>
              <DashboardPage />
            </Suspense>
          </AppShell>
        )
      },
      {
        path: 'patients',
        element: (
          <AppShell>
            <PlaceholderPage title="Hastalar" description="Hasta yönetimi yakında eklenecek." />
          </AppShell>
        )
      },
      {
        path: 'trials',
        element: (
          <AppShell>
            <PlaceholderPage title="Denemeler" description="Deneme modülü yakında eklenecek." />
          </AppShell>
        )
      },
      {
        path: 'inventory',
        element: (
          <AppShell>
            <PlaceholderPage title="Stok" description="Stok yönetimi yakında eklenecek." />
          </AppShell>
        )
      },
      {
        path: 'meetings',
        element: (
          <AppShell>
            <PlaceholderPage title="Görüşmeler" description="Görüşme merkezi yakında eklenecek." />
          </AppShell>
        )
      },
      {
        path: 'references',
        element: (
          <AppShell>
            <PlaceholderPage title="Referanslar" description="Referans yönetimi yakında eklenecek." />
          </AppShell>
        )
      },
      {
        path: 'audiogram',
        element: (
          <AppShell>
            <PlaceholderPage title="Odyogram" description="Odyogram aracı yakında eklenecek." />
          </AppShell>
        )
      },
      {
        path: 'profit-calculator',
        element: (
          <AppShell>
            <PlaceholderPage title="Kar Hesaplayıcı" description="Kar hesaplayıcı yakında eklenecek." />
          </AppShell>
        )
      }
    ]
  }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
