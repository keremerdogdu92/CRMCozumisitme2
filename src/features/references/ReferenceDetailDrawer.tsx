// src/features/references/ReferenceDetailDrawer.tsx
// Summary: Read-only detail drawer for a single reference, with tabs (summary/patients/gifts).
// Integrations:
// - SideDrawer layout shell
// - React Query: loads related patients/trials by reference_id
// - Soft delete / restore:
//   - Uses shared SoftDeleteRowActionButton (pure UI)
//   - Calls references RPC helpers (softDeleteReference / restoreReference)
//   - Invalidates all references queries after mutation to keep list in sync
//
// Notes:
// - This drawer intentionally closes after delete/restore to avoid stale in-memory `reference` props.

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SideDrawer } from '../../components/layout/SideDrawer';
import type { ReferenceRow } from './types';
import type { TrialRow } from '../trials/types';
import {
  TRIALS_BY_REFERENCE_QUERY_KEY,
  fetchTrialsByReferenceId,
} from '../trials/api';
import type { PatientForReference } from '../patients/api';
import {
  PATIENTS_BY_REFERENCE_QUERY_KEY,
  fetchPatientsByReferenceId,
} from '../patients/api';
import { ReferenceTabs, type ReferenceTabId } from './components/ReferenceTabs';
import { ReferenceSummarySection } from './components/ReferenceSummarySection';
import { ReferencePatientsSection } from './components/ReferencePatientsSection';
import { ReferenceGiftsSection } from './components/ReferenceGiftsSection';
import { SoftDeleteRowActionButton } from '../../components/softDelete/SoftDeleteRowActionButton';
import { restoreReference, softDeleteReference } from './api';

type ReferenceDetailDrawerProps = {
  reference: ReferenceRow | null;
  open: boolean;
  onClose: () => void;
};

export function ReferenceDetailDrawer({
  reference,
  open,
  onClose,
}: ReferenceDetailDrawerProps) {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ReferenceTabId>('summary');

  useEffect(() => {
    if (open) {
      setActiveTab('summary');
    }
  }, [open, reference?.id]);

  const referenceId = reference?.id ?? '';

  const isDeleted = useMemo(() => {
    return Boolean(reference?.deleted_at);
  }, [reference?.deleted_at]);

  const softDeleteMutation = useMutation({
    mutationFn: async (args: { id: string; reason: string | null }) => {
      await softDeleteReference(args.id, args.reason);
    },
    onSuccess: async () => {
      // Invalidate all references lists (active/deleted/all).
      await queryClient.invalidateQueries({ queryKey: ['references'] });

      // Close to prevent stale `reference` prop mismatch after list refresh.
      onClose();
    },
    onError: (err) => {
      const msg =
        (err as Error | null | undefined)?.message ??
        'Silme sırasında hata oluştu.';
      console.error('Reference soft delete failed (drawer):', err);
      window.alert(msg);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      await restoreReference(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['references'] });
      onClose();
    },
    onError: (err) => {
      const msg =
        (err as Error | null | undefined)?.message ??
        'Geri alma sırasında hata oluştu.';
      console.error('Reference restore failed (drawer):', err);
      window.alert(msg);
    },
  });

  const isMutating = softDeleteMutation.isPending || restoreMutation.isPending;

  const handleSoftDeleteClick = () => {
    if (!reference?.id) return;

    // Defensive guard: do not soft delete an already-deleted row.
    if (reference.deleted_at) return;

    const ok = window.confirm(
      `${reference.full_name ?? 'Bu referans'} kaydını silmek istiyor musun?\n\nBu işlem kalıcı silme değildir (soft delete).`,
    );
    if (!ok) return;

    // Optional reason (kept minimal to avoid introducing new UI components).
    const reasonRaw = window.prompt('Silme nedeni (opsiyonel):', '') ?? '';
    const reason = reasonRaw.trim().length > 0 ? reasonRaw.trim() : null;

    softDeleteMutation.mutate({ id: reference.id, reason });
  };

  const handleRestoreClick = () => {
    if (!reference?.id) return;

    // Defensive guard: only restore if currently deleted.
    if (!reference.deleted_at) return;

    const ok = window.confirm(
      `${reference.full_name ?? 'Bu referans'} kaydını geri almak istiyor musun?`,
    );
    if (!ok) return;

    restoreMutation.mutate(reference.id);
  };

  const {
    data: trialsForReference = [],
    isLoading: isLoadingTrials,
    isError: isTrialsError,
  } = useQuery<TrialRow[]>({
    queryKey: TRIALS_BY_REFERENCE_QUERY_KEY(referenceId),
    queryFn: () => fetchTrialsByReferenceId(referenceId),
    enabled: !!referenceId && open && activeTab === 'patients',
  });

  const {
    data: patientsForReference = [],
    isLoading: isLoadingPatients,
    isError: isPatientsError,
  } = useQuery<PatientForReference[]>({
    queryKey: PATIENTS_BY_REFERENCE_QUERY_KEY(referenceId),
    queryFn: () => fetchPatientsByReferenceId(referenceId),
    enabled: !!referenceId && open && activeTab === 'patients',
  });

  if (!reference) {
    return null;
  }

  const tabs: { id: ReferenceTabId; label: string }[] = [
    { id: 'summary', label: 'Özet' },
    { id: 'patients', label: 'Hastalar' },
    { id: 'gifts', label: 'Hediye / Komisyon' },
  ];

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Referans Detayı"
      subtitle="İlişki geçmişi, hastalar ve hediye/komisyon bilgileri"
    >
      <div className="flex h-full flex-col">
        {/* Drawer header actions (soft delete / restore) */}
        <div className="px-4 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {reference.full_name ?? '-'}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {isDeleted ? 'Durum: Silinmiş' : 'Durum: Aktif'}
              </p>
            </div>

            <div className="shrink-0">
              <SoftDeleteRowActionButton
                isDeleted={isDeleted}
                isBusy={isMutating}
                size="sm"
                onSoftDelete={handleSoftDeleteClick}
                onRestore={handleRestoreClick}
              />
            </div>
          </div>
        </div>

        <div className="mt-3">
          <ReferenceTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
          {activeTab === 'summary' && (
            <ReferenceSummarySection reference={reference} />
          )}

          {activeTab === 'patients' && (
            <ReferencePatientsSection
              patientsForReference={patientsForReference}
              trialsForReference={trialsForReference}
              isLoadingPatients={isLoadingPatients}
              isLoadingTrials={isLoadingTrials}
              isPatientsError={isPatientsError}
              isTrialsError={isTrialsError}
            />
          )}

          {activeTab === 'gifts' && (
            <ReferenceGiftsSection referenceId={referenceId} />
          )}
        </div>
      </div>
    </SideDrawer>
  );
}
