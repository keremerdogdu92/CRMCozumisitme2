import { PropsWithChildren } from 'react';
import { Sidebar } from '../navigation/Sidebar';
import { Topbar } from '../navigation/Topbar';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
