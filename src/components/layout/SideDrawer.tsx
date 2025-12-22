// src/components/layout/SideDrawer.tsx
// Generic right-side drawer shell with overlay, header, optional subtitle and footer.
// Mobile-first: full-width on small screens, constrained width on larger screens.

import type { ReactNode } from 'react';

type SideDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function SideDrawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
}: SideDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-30 bg-slate-900/30"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-full sm:max-w-md md:max-w-lg lg:max-w-xl flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Kapat
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {/* Footer (optional) */}
        {footer && (
          <div className="border-t border-slate-200 px-4 py-3">
            <div className="flex justify-end gap-2">{footer}</div>
          </div>
        )}
      </div>
    </>
  );
}
