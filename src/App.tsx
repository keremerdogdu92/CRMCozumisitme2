// src/App.tsx
import {
  Outlet,
  RouterProvider,
  createBrowserRouter,
  Navigate,
} from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';
import { AppProviders } from './providers/AppProviders';
import { AppShell } from './components/layout/AppShell';
import { LoadingScreen } from './components/status/LoadingScreen';
import { supabaseClient } from './utils/supabaseClient';

const MeetingsPage = lazy(() => import('./pages/MeetingsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const TrialsPage = lazy(() => import('./pages/TrialsPage'));
const ReferencesPage = lazy(() => import('./pages/ReferencesPage'));
const ProfitCalculatorPage = lazy(
  () => import('./pages/ProfitCalculatorPage'),
);

/**
 * ProtectedLayout:
 * - Supabase session var mı kontrol eder
 * - Yoksa /login'e yönlendirir
 * - Varsa AppShell + Suspense + Outlet ile içeriği gösterir
 */
function ProtectedLayout() {
  const [status, setStatus] = useState<'loading' | 'authed' | 'guest'>(
    'loading',
  );

  useEffect(() => {
    const run = async () => {
      const { data } = await supabaseClient.auth.getSession();
      if (data.session) {
        setStatus('authed');
      } else {
        setStatus('guest');
      }
    };

    void run();
  }, []);

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  if (status === 'guest') {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Suspense fallback={<LoadingScreen />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <AppProviders>
        <Suspense fallback={<LoadingScreen />}>
          <LoginPage />
        </Suspense>
      </AppProviders>
    ),
  },
  {
    path: '/',
    element: (
      <AppProviders>
        <ProtectedLayout />
      </AppProviders>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'patients',
        element: <PatientsPage />,
      },
      {
        path: 'trials',
        element: <TrialsPage />,
      },
      {
        path: 'inventory',
        element: (
          <PlaceholderPage
            title="Stok"
            description="Stok yönetimi yakında eklenecek."
          />
        ),
      },
      {
        path: 'meetings',
        element: <MeetingsPage />,
      },
      {
        path: 'references',
        element: <ReferencesPage />,
      },
      {
        path: 'audiogram',
        element: (
          <PlaceholderPage
            title="Odyogram"
            description="Odyogram aracı yakında eklenecek."
          />
        ),
      },
      {
        path: 'profit-calculator',
        element: <ProfitCalculatorPage />,
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
