// src/components/softDelete/SoftDeleteRowActionButton.tsx
// Summary: Shared row-level soft delete / restore action button used across tables and detail drawers.
// Integrations:
// - Pure UI component: does not know about Supabase, React Query, or confirm/prompt.
// - Caller provides onSoftDelete/onRestore handlers (can include confirm/prompt + RPC + invalidation).
//
// Notes:
// - Mobile-first sizing supported via `size`.
// - Keeps consistent visual language across list/table and detail views.

import type { ReactNode } from 'react';

export type SoftDeleteRowActionButtonSize = 'xs' | 'sm';

type Props = {
  isDeleted: boolean;
  isBusy?: boolean;

  /**
   * Called when user clicks "Sil".
   * Caller should handle confirm/prompt and actual RPC mutation.
   */
  onSoftDelete: () => void;

  /**
   * Called when user clicks "Geri getir".
   * Caller should handle confirm and actual RPC mutation.
   * If omitted, deleted rows render no restore action.
   */
  onRestore?: () => void;

  /**
   * Optional: override button labels.
   */
  deleteLabel?: ReactNode;
  restoreLabel?: ReactNode;

  /**
   * Optional: size preset to match different contexts (table vs card vs drawer).
   */
  size?: SoftDeleteRowActionButtonSize;

  /**
   * Optional: tooltip/title text.
   */
  deleteTitle?: string;
  restoreTitle?: string;

  /**
   * Optional className for outer wrapper.
   */
  className?: string;
};

function getButtonBaseClass(size: SoftDeleteRowActionButtonSize) {
  // Keep sizes consistent across desktop table + mobile cards.
  if (size === 'xs') {
    return 'px-3 py-1 text-[11px]';
  }
  return 'px-3 py-1 text-xs';
}

export function SoftDeleteRowActionButton({
  isDeleted,
  isBusy = false,
  onSoftDelete,
  onRestore,
  deleteLabel,
  restoreLabel,
  size = 'sm',
  deleteTitle,
  restoreTitle,
  className,
}: Props) {
  const base = getButtonBaseClass(size);

  return (
    <span className={className ?? ''}>
      {isDeleted ? (
        onRestore ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={onRestore}
          className={
            'inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 ' +
            base
          }
          title={restoreTitle ?? 'Silinmiş kaydı geri getir'}
        >
          {restoreLabel ?? 'Geri getir'}
        </button>
        ) : null
      ) : (
        <button
          type="button"
          disabled={isBusy}
          onClick={onSoftDelete}
          className={
            'inline-flex items-center rounded-md border border-rose-200 bg-rose-50 font-medium text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 ' +
            base
          }
          title={deleteTitle ?? 'Kayıt soft delete yapılır'}
        >
          {deleteLabel ?? 'Sil'}
        </button>
      )}
    </span>
  );
}
