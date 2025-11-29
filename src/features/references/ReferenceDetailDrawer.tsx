// src/features/references/ReferenceDetailDrawer.tsx
// Read-only detail drawer for a reference, with tabs for summary, patients and gifts.

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import {
  ReferenceTabs,
  type ReferenceTabId,
} from './components/ReferenceTabs';
import { ReferenceSummarySection } from './components/ReferenceSummarySection';
import { ReferencePatientsSection } from './components/ReferencePatientsSection';
import { ReferenceGiftsSection } from './components/ReferenceGiftsSection';

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
  const [activeTab, setActiveTab] = useState<ReferenceTabId>('summary');

  useEffect(() => {
    if (open) {
      setActiveTab('summary');
    }
  }, [open, reference?.id]);

  // Hook'lar her zaman aynı sırada çalışsın diye referenceId'yi
  // null-safe şekilde hesaplıyoruz ve enabled flag'i ile kontrol ediyoruz.
  const referenceId = reference?.id ?? '';

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

  // Hook'lardan SONRA erken dönüş yapıyoruz; bu React hook kurallarına uygun.
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
        {/* Tab bar */}
        <ReferenceTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Tab contents */}
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

          {activeTab === 'gifts' && <ReferenceGiftsSection />}
        </div>
      </div>
    </SideDrawer>
  );
}
