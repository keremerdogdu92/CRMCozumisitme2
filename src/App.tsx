import { Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AppProviders } from './providers/AppProviders';
import { AppShell } from './components/layout/AppShell';
import { LoadingScreen } from './components/status/LoadingScreen';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'));

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AppProviders>
        <AppShell>
          <Suspense fallback={<LoadingScreen />}>
            <Outlet />
          </Suspense>
        </AppShell>
      </AppProviders>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />
      },
      {
        path: 'patients',
        element: <PlaceholderPage title="Hastalar" description="Hasta yönetimi yakında eklenecek." />
      },
      {
        path: 'trials',
        element: <PlaceholderPage title="Denemeler" description="Deneme modülü yakında eklenecek." />
      },
      {
        path: 'inventory',
        element: <PlaceholderPage title="Stok" description="Stok yönetimi yakında eklenecek." />
      },
      {
        path: 'meetings',
        element: <PlaceholderPage title="Görüşmeler" description="Görüşme merkezi yakında eklenecek." />
      },
      {
        path: 'references',
        element: <PlaceholderPage title="Referanslar" description="Referans yönetimi yakında eklenecek." />
      },
      {
        path: 'audiogram',
        element: <PlaceholderPage title="Odyogram" description="Odyogram aracı yakında eklenecek." />
      },
      {
        path: 'profit-calculator',
        element: <PlaceholderPage title="Kar Hesaplayıcı" description="Kar hesaplayıcı yakında eklenecek." />
      }
    ]
  }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
