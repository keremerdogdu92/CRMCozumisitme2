// src/components/ui/IconButton.tsx
// Icon-only button for compact actions such as table row controls or toolbar icons.

import type { ButtonHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

type IconButtonVariant = 'default' | 'ghost' | 'danger';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  variant?: IconButtonVariant;
  size?: 'sm' | 'md';
  className?: string;
  /**
   * Accessible label for screen readers.
   * Required because this button has no text content.
   */
  ariaLabel: string;
  icon: React.ReactNode;
}

function getVariantClasses(variant: IconButtonVariant): string {
  switch (variant) {
    case 'ghost':
      return 'bg-transparent text-slate-600 hover:bg-slate-100 border border-transparent';
    case 'danger':
      return 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200';
    case 'default':
    default:
      return 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300';
  }
}

function getSizeClasses(size: 'sm' | 'md'): string {
  switch (size) {
    case 'sm':
      return 'h-8 w-8 text-xs';
    case 'md':
    default:
      return 'h-9 w-9 text-sm';
  }
}

export function IconButton(props: IconButtonProps) {
  const {
    variant = 'default',
    size = 'md',
    className,
    ariaLabel,
    icon,
    type,
    ...rest
  } = props;

  const resolvedType = type ?? 'button';

  const baseClasses =
    'inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 disabled:opacity-60 disabled:cursor-not-allowed';

  const composedClassName = twMerge(
    baseClasses,
    getVariantClasses(variant),
    getSizeClasses(size),
    className,
  );

  return (
    <button
      type={resolvedType}
      className={composedClassName}
      aria-label={ariaLabel}
      {...rest}
    >
      {icon}
    </button>
  );
}
