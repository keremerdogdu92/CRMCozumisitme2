// src/components/layout/PageHeader.tsx
// Reusable page header with title, optional subtitle and right-side actions.

import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
};

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        )}
      </div>

      {right && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {right}
        </div>
      )}
    </div>
  );
}
