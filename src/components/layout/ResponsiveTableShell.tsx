// src/components/layout/ResponsiveTableShell.tsx
// Shared shell for data tables: padding, border, scroll and subtle shadow.
// Mobile-friendly: full-width container with horizontal scrolling when needed.

import type { ReactNode } from 'react';

type ResponsiveTableShellProps = {
  children: ReactNode;
  className?: string;
};

export function ResponsiveTableShell({
  children,
  className = '',
}: ResponsiveTableShellProps) {
  const baseClasses =
    'w-full max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm';

  return <div className={`${baseClasses} ${className}`}>{children}</div>;
}
