// src/components/layout/AppShell.tsx
// Main application shell with persistent sidebar and topbar.
// v3 – Mobile-first layout tweaks:
// - Hides desktop sidebar on small screens; SidebarMobile handles nav.
// - Uses min-h-screen for scrollable content on small devices.
// - Adds responsive paddings and prevents horizontal overflow on main area.

import { useState, type PropsWithChildren } from 'react';
import { Sidebar, SidebarMobile } from '../navigation/Sidebar';
import { Topbar } from '../navigation/Topbar';

export function AppShell({ children }: PropsWithChildren) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen min-w-0 bg-[rgb(var(--color-app-bg))]">
      {/* Desktop sidebar (md and up) */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar (drawer) */}
      <SidebarMobile
        open={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setIsMobileSidebarOpen(true)} />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
