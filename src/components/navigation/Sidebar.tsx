// src/components/navigation/Sidebar.tsx
// Navigation sidebar for desktop and mobile, including a Settings entry.
import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  Activity,
  BookUser,
  Boxes,
  CalendarClock,
  Calculator,
  ClipboardList,
  FlaskConical,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useCurrentProfile } from '../../features/auth/useCurrentProfile';

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Pano', icon: <ClipboardList className="h-5 w-5" /> },
  { path: '/patients', label: 'Hastalar', icon: <Users className="h-5 w-5" /> },
  {
    path: '/trials',
    label: 'Denemeler',
    icon: <FlaskConical className="h-5 w-5" />,
  },
  { path: '/inventory', label: 'Stok', icon: <Boxes className="h-5 w-5" /> },
  {
    path: '/meetings',
    label: 'Görüşmeler',
    icon: <CalendarClock className="h-5 w-5" />,
  },
  {
    path: '/references',
    label: 'Referanslar',
    icon: <BookUser className="h-5 w-5" />,
  },
  { path: '/audiogram', label: 'Odyogram', icon: <Activity className="h-5 w-5" /> },
  {
    path: '/profit-calculator',
    label: 'Kar Hesaplayıcı',
    icon: <Calculator className="h-5 w-5" />,
  },
  {
    path: '/settings',
    label: 'Ayarlar',
    icon: <Settings className="h-5 w-5" />,
  },
];

function SidebarNav({
  onItemClick,
  isAdmin,
}: {
  onItemClick?: () => void;
  isAdmin: boolean;
}) {
  const itemsToRender = NAV_ITEMS.filter((item) => {
    // Hide References and Profit Calculator for non-admin users
    if (!isAdmin && (item.path === '/references' || item.path === '/profit-calculator')) {
      return false;
    }
    return true;
  });

  return (
    <nav className="flex-1 space-y-1 p-4">
      {itemsToRender.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary-100 text-primary-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
          onClick={onItemClick}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.role === 'admin';

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500 font-semibold text-white">
            Ç
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Çözüm İşitme</p>
            <p className="text-xs text-slate-500">CRM Sistemi</p>
          </div>
        </div>

        <SidebarNav isAdmin={isAdmin} />
      </div>
    </aside>
  );
}

type SidebarMobileProps = {
  open: boolean;
  onClose: () => void;
};

export function SidebarMobile({ open, onClose }: SidebarMobileProps) {
  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.role === 'admin';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex lg:hidden" aria-modal="true" role="dialog">
      <div
        className="fixed inset-0 bg-slate-900/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="relative z-50 flex w-64 flex-col border-r border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify_between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500 text-sm font-semibold text-white">
              Ç
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Çözüm İşitme</p>
              <p className="text-xs text-slate-500">CRM Sistemi</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Menüyü kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <SidebarNav onItemClick={onClose} isAdmin={isAdmin} />
      </aside>
    </div>
  );
}
