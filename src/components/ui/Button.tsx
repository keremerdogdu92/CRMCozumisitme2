// src/components/ui/Button.tsx
// Reusable button component with variants and sizes for the CRM UI.
// Mobile-first, Tailwind-based, used as the primary clickable action element across pages.

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
}

/**
 * Return Tailwind classes for the given button variant.
 * These classes define color, border and basic visual identity.
 */
function getVariantClasses(variant: ButtonVariant): string {
  switch (variant) {
    case 'secondary':
      return 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300';
    case 'danger':
      return 'bg-red-600 text-white hover:bg-red-700 border border-red-700';
    case 'ghost':
      return 'bg-transparent text-slate-700 hover:bg-slate-100 border border-transparent';
    case 'link':
      return 'bg-transparent text-sky-600 hover:text-sky-700 underline-offset-2 hover:underline border-none px-0';
    case 'primary':
    default:
      return 'bg-sky-600 text-white hover:bg-sky-700 border border-sky-700';
  }
}

/**
 * Return Tailwind classes for the given button size.
 * These classes define padding, font size and icon spacing.
 */
function getSizeClasses(size: ButtonSize): string {
  switch (size) {
    case 'sm':
      return 'h-8 px-3 text-xs gap-1';
    case 'lg':
      return 'h-11 px-5 text-base gap-2';
    case 'md':
    default:
      return 'h-10 px-4 text-sm gap-2';
  }
}

/**
 * Central button implementation for the CRM app.
 * - Uses Tailwind for layout and colors.
 * - Exposes variant/size/fullWidth/isLoading to keep usage consistent.
 * - For navigation links, prefer using a router <Link> that wraps this button visually.
 */
export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    fullWidth,
    isLoading,
    disabled,
    leftIcon,
    rightIcon,
    children,
    className,
    type,
    ...rest
  } = props;

  const resolvedType = type ?? 'button';
  const isDisabled = disabled || isLoading;

  const baseClasses =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap';

  const widthClasses = fullWidth ? 'w-full' : 'w-auto';
  const variantClasses = getVariantClasses(variant);
  const sizeClasses = getSizeClasses(size);

  const composedClassName = twMerge(
    baseClasses,
    widthClasses,
    variantClasses,
    sizeClasses,
    className,
  );

  return (
    <button
      type={resolvedType}
      className={composedClassName}
      disabled={isDisabled}
      {...rest}
    >
      {leftIcon && (
        <span className="flex items-center justify-center">{leftIcon}</span>
      )}
      <span className="flex items-center justify-center">
        {isLoading ? 'Loading…' : children}
      </span>
      {rightIcon && (
        <span className="flex items-center justify-center">{rightIcon}</span>
      )}
    </button>
  );
}
