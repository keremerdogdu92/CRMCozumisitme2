import { NavLink } from 'react-router-dom';
import { ReactNode } from 'react';
import { ClipboardList, Users, FlaskConical, Boxes, CalendarClock, BookUser, Waveform, Calculator } from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Pano', icon: <ClipboardList className="h-5 w-5" /> },
  { path: '/patients', label: 'Hastalar', icon: <Users className="h-5 w-5" /> },
  { path: '/trials', label: 'Denemeler', icon: <FlaskConical className="h-5 w-5" /> },
  { path: '/inventory', label: 'Stok', icon: <Boxes className="h-5 w-5" /> },
  { path: '/meetings', label: 'Görüşmeler', icon: <CalendarClock className="h-5 w-5" /> },
  { path: '/references', label: 'Referanslar', icon: <BookUser className="h-5 w-5" /> },
  { path: '/audiogram', label: 'Odyogram', icon: <Waveform className="h-5 w-5" /> },
  { path: '/profit-calculator', label: 'Kar Hesaplayıcı', icon: <Calculator className="h-5 w-5" /> }
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500 font-semibold text-white">
            Çİ
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Çözüm İşitme</p>
            <p className="text-xs text-slate-500">CRM Sistemi</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {NAV_ITEMS.map((item) => (
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
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
