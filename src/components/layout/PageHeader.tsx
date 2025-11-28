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
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-900 md:text-lg">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-slate-500 md:text-xs">
            {subtitle}
          </p>
        )}
      </div>

      {right && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {right}
        </div>
      )}
    </div>
  );
}
