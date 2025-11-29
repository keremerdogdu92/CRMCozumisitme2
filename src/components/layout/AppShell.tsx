// src/components/layout/AppShell.tsx
// Main application shell with persistent sidebar and topbar.
// v2 – Adds mobile sidebar drawer controlled by Topbar menu button.

import { useState, type PropsWithChildren } from 'react';
import { Sidebar, SidebarMobile } from '../navigation/Sidebar';
import { Topbar } from '../navigation/Topbar';

export function AppShell({ children }: PropsWithChildren) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile sidebar (drawer) */}
      <SidebarMobile
        open={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col">
        <Topbar onMenuClick={() => setIsMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
