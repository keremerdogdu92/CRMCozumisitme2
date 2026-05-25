// src/App.tsx
// Patch v2:
// - Adds public routes: /forgot-password and /reset-password.
// - Keeps ProtectedLayout for app routes only.

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
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const TrialsPage = lazy(() => import('./pages/TrialsPage'));
const ReferencesPage = lazy(() => import('./pages/ReferencesPage'));
const ProfitCalculatorPage = lazy(
  () => import('./pages/ProfitCalculatorPage'),
);
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));

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
    path: '/forgot-password',
    element: (
      <AppProviders>
        <Suspense fallback={<LoadingScreen />}>
          <ForgotPasswordPage />
        </Suspense>
      </AppProviders>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <AppProviders>
        <Suspense fallback={<LoadingScreen />}>
          <ResetPasswordPage />
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
        element: <InventoryPage />,
      },
      {
        path: 'meetings',
        element: <MeetingsPage />,
      },
      {
        path: 'tasks',
        element: <TasksPage />,
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
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'reports',
        element: <ReportsPage />,
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
