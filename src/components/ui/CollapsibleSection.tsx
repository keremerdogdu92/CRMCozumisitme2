// src/components/ui/CollapsibleSection.tsx
// Generic collapsible container for forms and sections with a title row and optional badge.

import type { PropsWithChildren, ReactNode } from 'react';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface CollapsibleSectionProps extends PropsWithChildren {
  title: string;
  /**
   * Optional description text below the title.
   */
  description?: string;
  /**
   * Optional small badge such as "Zorunlu" or "Opsiyonel".
   */
  badgeText?: string;
  /**
   * If provided, the section is initially open or closed based on this value.
   */
  defaultOpen?: boolean;
  /**
   * Optional right-aligned node in the header row (e.g. small actions).
   */
  headerRight?: ReactNode;
  /**
   * Optional callback when open state changes.
   */
  onToggle?(isOpen: boolean): void;
  className?: string;
}

export function CollapsibleSection(props: CollapsibleSectionProps) {
  const {
    title,
    description,
    badgeText,
    defaultOpen = true,
    headerRight,
    onToggle,
    className,
    children,
  } = props;

  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (onToggle) onToggle(next);
  };

  const rootClasses = twMerge(
    'rounded-lg border border-slate-200 bg-white shadow-sm',
    className,
  );

  return (
    <section className={rootClasses}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-5 w-5 items-center justify-center text-slate-500">
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {title}
            </span>
            {badgeText && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {badgeText}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-slate-500">{description}</p>
          )}
        </div>
        {headerRight && (
          <div className="ml-2 flex items-center gap-2">{headerRight}</div>
        )}
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 px-4 py-4 sm:px-5 sm:py-5">
          {children}
        </div>
      )}
    </section>
  );
}
