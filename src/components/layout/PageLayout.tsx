// src/components/layout/PageLayout.tsx
// High-level page container that standardizes spacing and vertical layout.
// Intended to be used inside AppShell main area for all feature pages.

import type { PropsWithChildren, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

type PageMaxWidth = 'full' | 'lg' | 'xl';

export interface PageLayoutProps extends PropsWithChildren {
  /**
   * Optional header node, typically a PageHeader component.
   */
  header?: ReactNode;
  /**
   * Constrain content width for readability.
   */
  maxWidth?: PageMaxWidth;
  /**
   * Control outer padding. "md" is recommended for most pages.
   */
  padding?: 'none' | 'sm' | 'md';
  /**
   * If true, fills entire available height (useful for full-page layouts).
   */
  fillHeight?: boolean;
  className?: string;
}

function getMaxWidthClasses(maxWidth: PageMaxWidth): string {
  switch (maxWidth) {
    case 'lg':
      return 'mx-auto min-w-0 w-full max-w-5xl';
    case 'xl':
      return 'mx-auto min-w-0 w-full max-w-6xl';
    case 'full':
    default:
      return 'min-w-0 w-full max-w-full';
  }
}

function getPaddingClasses(padding: 'none' | 'sm' | 'md'): string {
  switch (padding) {
    case 'none':
      return '';
    case 'sm':
      return 'px-3 py-3 sm:px-4 sm:py-4';
    case 'md':
    default:
      return 'px-4 py-4 sm:px-6 sm:py-5';
  }
}

/**
 * PageLayout provides a consistent mobile-first page scaffold:
 * - Optional header at the top.
 * - Content area with configurable max width and padding.
 * - Works inside AppShell's main area.
 */
export function PageLayout(props: PageLayoutProps) {
  const {
    header,
    maxWidth = 'full',
    padding = 'md',
    fillHeight = false,
    className,
    children,
  } = props;

  const rootClasses = twMerge(
    'flex min-w-0 w-full flex-col gap-4',
    fillHeight && 'h-full',
    getPaddingClasses(padding),
    className,
  );

  return (
    <div className={rootClasses}>
      {header && <div className={getMaxWidthClasses(maxWidth)}>{header}</div>}
      <div className={getMaxWidthClasses(maxWidth)}>{children}</div>
    </div>
  );
}
