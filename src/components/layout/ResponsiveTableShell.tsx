// src/components/layout/ResponsiveTableShell.tsx
// Shared shell for data tables: padding, border, scroll and subtle shadow.

import type { ReactNode } from 'react';

type ResponsiveTableShellProps = {
  children: ReactNode;
  className?: string;
};

export function ResponsiveTableShell({
  children,
  className = '',
}: ResponsiveTableShellProps) {
  return (
    <div
      className={
        'overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm ' +
        className
      }
    >
      {children}
    </div>
  );
}
