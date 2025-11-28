// src/components/layout/FormSection.tsx
// Shared section wrapper for forms: title + soft card background.

import type { ReactNode } from 'react';

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function FormSection({
  title,
  description,
  children,
  className = '',
}: FormSectionProps) {
  return (
    <section
      className={
        'space-y-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-3 ' +
        className
      }
    >
      <div>
        <h4 className="text-xs font-semibold uppercase text-slate-500">
          {title}
        </h4>
        {description && (
          <p className="mt-1 text-[11px] text-slate-500">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
