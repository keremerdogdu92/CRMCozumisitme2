// src/components/layout/InlineCreateCard.tsx
// Collapsible inline create/edit card with header, description and optional error message.
// Default behavior: when closed (open === false), card is not rendered at all.
// If needed in other screens, renderWhenClosed can be set to true to keep the header visible.

import type { ReactNode } from 'react';

type InlineCreateCardProps = {
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  errorMessage?: string;
  children: ReactNode;
  /**
   * When true, the header stays visible even if the form is closed.
   * Default is false: when open === false, the whole card is hidden.
   */
  renderWhenClosed?: boolean;
};

export function InlineCreateCard({
  title,
  description,
  open,
  onToggle,
  errorMessage,
  children,
  renderWhenClosed = false,
}: InlineCreateCardProps) {
  // Default: hide the entire card when closed.
  if (!open && !renderWhenClosed) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {/* Header with toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{open ? 'Formu Kapat' : 'Formu Aç'}</span>
          <span
            className={
              'inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[10px] ' +
              (open ? 'bg-slate-50' : 'bg-white')
            }
          >
            {open ? '−' : '+'}
          </span>
        </div>
      </button>

      {/* Optional generic error slot */}
      {errorMessage && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2">
          <p className="text-[11px] text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* Body */}
      {open && <div className="border-t border-slate-100 px-4 py-4">{children}</div>}
    </div>
  );
}
