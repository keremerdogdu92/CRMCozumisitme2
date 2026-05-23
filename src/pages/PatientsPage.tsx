// src/pages/PatientsPage.tsx
// Summary: Container page for Patients with responsive layout and filters.
// Integrations:
// - React Query fetch via fetchPatients({ mode }) with soft delete visibility mode.
// - Table UI preferences: reads "showSoftDeleteFilter" toggle from the patients table prefs.
// - Soft delete + restore actions are performed via DB RPC wrappers:
//    * softDeletePatient(patientId, reason)
//    * restorePatient(patientId)
//
// Patch:
// - Wires PatientsTable onDeletePatient + onRestorePatient.
// - Uses React Query mutations and invalidates PATIENTS_QUERY_KEY.
// - IMPORTANT: After patient soft delete, also invalidates INVENTORY_QUERY_KEY so returned-to-stock
//   inventory items (sold -> in_stock) refresh immediately.
// - If the deleted patient is currently open in the detail drawer, the drawer is closed to avoid stale UI.

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  PATIENTS_QUERY_KEY,
  fetchPatients,
  updatePatientSgkFields,
  createPatientFromForm,
  softDeletePatient,
  restorePatient,
} from '../features/patients/api';
import { INVENTORY_QUERY_KEY } from '../features/inventory/api';
import type { NewPatientForm, PatientRow } from '../features/patients/types';
import {
  NewPatientFormCard,
  PatientDetailDrawer,
  PatientsTable,
} from '../features/patients/ui';
import { useCurrentProfile } from '../features/auth/useCurrentProfile';
import type { SoftDeleteMode } from '../utils/softDelete/softDeleteTypes';
import { SoftDeleteModeFilter } from '../components/table/SoftDeleteModeFilter';
import { useTablePreferences } from '../components/table/useTablePreferences';
import type { TableColumnDef } from '../components/table/tableTypes';

type PatientDetailTabId =
  | 'info'
  | 'devices'
  | 'meetings'
  | 'payments'
  | 'audiogram';

type PatientsPageLocationState =
  | {
      fromTrial?: {
        trialId: string;
        fullName: string;
        phone: string | null;
        referenceId: string | null;
        referenceName?: string | null;
        note?: string | null;
      };
      fromTrialDevices?: { side: string | null; brand: string | null; model: string | null }[];
    }
  | undefined;

const EMPTY_COLUMNS: TableColumnDef<PatientRow>[] = [];
const PATIENTS_TABLE_PREFS_ID = 'patients';

export default function PatientsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const location = useLocation() as { state?: PatientsPageLocationState };

  const { data: profile } = useCurrentProfile();
  const userId = profile?.id ?? null;
  const isAdmin = profile?.role === 'admin';

  const linkedTrialId = searchParams.get('trialId');
  const focusPatientId = searchParams.get('focusId');
  const openedFromTrial = !!location.state?.fromTrial;

  const [search, setSearch] = useState('');
  const [sgkFilter, setSgkFilter] = useState<'all' | 'sgk' | 'non-sgk'>('all');
  const [showCreateForm, setShowCreateForm] = useState<boolean>(openedFromTrial);
  const [detailPatient, setDetailPatient] = useState<PatientRow | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<PatientDetailTabId>('info');
  const [detailInitialShowPlan, setDetailInitialShowPlan] = useState<boolean>(false);

  const [softDeleteMode, setSoftDeleteMode] = useState<SoftDeleteMode>('active');
  const effectiveSoftDeleteMode: SoftDeleteMode = focusPatientId ? 'all' : softDeleteMode;

  const { data, isLoading, isError } = useQuery({
    queryKey: [...PATIENTS_QUERY_KEY, { mode: effectiveSoftDeleteMode }],
    queryFn: () => fetchPatients({ mode: effectiveSoftDeleteMode }),
  });

  const createMutation = useMutation({
    mutationFn: async (values: NewPatientForm) => {
      const patient = await createPatientFromForm(
        values,
        linkedTrialId ? { linkedTrialId } : undefined,
      );
      return patient;
    },
    onSuccess: (createdPatient, variables) => {
      void queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
      setShowCreateForm(false);

      if (variables.paymentMethod === 'Senet' && createdPatient) {
        setDetailPatient(createdPatient);
        setDetailInitialTab('payments');
        setDetailInitialShowPlan(true);
      }
    },
  });

  const sgkUpdateMutation = useMutation({
    mutationFn: updatePatientSgkFields,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
    },
  });

  const softDeleteMutation = useMutation({
    mutationFn: async (patientId: string) => {
      await softDeletePatient(patientId, 'manual_soft_delete');
    },
    onSuccess: (_data, patientId) => {
      // 1) Refresh patient list
      void queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });

      // 2) Refresh inventory list because DB soft-delete RPC returns SOLD items to stock
      void queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });

      // 3) If the deleted patient is currently open in the drawer, close it to avoid stale UI
      setDetailPatient((current) => {
        if (!current) return current;
        return current.id === patientId ? null : current;
      });
    },
    onError: (err) => {
      const message =
        err instanceof Error
          ? err.message
          : 'Hasta silinirken beklenmeyen bir hata oluştu.';
      // eslint-disable-next-line no-alert
      alert(message);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (patientId: string) => {
      await restorePatient(patientId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
    },
    onError: (err) => {
      const message =
        err instanceof Error
          ? err.message
          : 'Hasta geri alınırken beklenmeyen bir hata oluştu.';
      // eslint-disable-next-line no-alert
      alert(message);
    },
  });

  const patients = data ?? [];

  const { isUiFlagEnabled } = useTablePreferences(
    PATIENTS_TABLE_PREFS_ID,
    EMPTY_COLUMNS,
    userId,
  );

  const showSoftDeleteFilter = isUiFlagEnabled('showSoftDeleteFilter', true);

  const focusPatient: PatientRow | null =
    focusPatientId && patients.length > 0
      ? patients.find((p) => p.id === focusPatientId) ?? null
      : null;

  const filteredPatients = useMemo(() => {
    if (focusPatient) return [focusPatient];

    return patients.filter((p) => {
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        p.full_name.toLowerCase().includes(term) ||
        (p.phone ?? '').toLowerCase().includes(term);

      const matchesSgk =
        sgkFilter === 'all' ||
        (sgkFilter === 'sgk' && !!p.sgk_flag) ||
        (sgkFilter === 'non-sgk' && !p.sgk_flag);

      return matchesSearch && matchesSgk;
    });
  }, [focusPatient, patients, search, sgkFilter]);

  if (isLoading) {
    return <div className="p-4 text-sm text-slate-500 sm:p-8">Hastalar yükleniyor...</div>;
  }

  if (isError) {
    return (
      <div className="p-4 text-sm text-red-600 sm:p-8">
        Hasta verileri alınırken bir hata oluştu. Lütfen Supabase bağlantısını ve RLS ayarlarını kontrol edin.
      </div>
    );
  }

  const mutationError = (createMutation.error as Error | null | undefined)?.message ?? '';

  const handleToggleCreateForm = () => setShowCreateForm((prev) => !prev);
  const handleCreateSubmit = (values: NewPatientForm) => createMutation.mutate(values);

  const handleSelectPatient = (patient: PatientRow) => {
    setDetailPatient(patient);
    setDetailInitialTab('info');
    setDetailInitialShowPlan(false);
  };

  const handleCloseDrawer = () => setDetailPatient(null);

  const handleDeletePatientFromList = (patient: PatientRow) => {
    if (softDeleteMutation.isPending) return;
    softDeleteMutation.mutate(patient.id);
  };

  const handleRestorePatientFromList = (patient: PatientRow) => {
    if (restoreMutation.isPending) return;
    restoreMutation.mutate(patient.id);
  };

  return (
    <div className="space-y-5 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Hastalar</h2>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
            Toplam {filteredPatients.length} kayıt
          </p>
          {focusPatientId && (
            <p className="mt-1 text-[11px] text-primary-700">
              Görüşmeden gelindi. Sadece seçilen hasta kaydı gösteriliyor.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3 shadow-sm sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:space-y-0 sm:bg-slate-50">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 sm:text-xs">SGK filtre:</span>
            <select
              value={sgkFilter}
              onChange={(e) => setSgkFilter(e.target.value as 'all' | 'sgk' | 'non-sgk')}
              disabled={!!focusPatientId}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60"
            >
              <option value="all">Hepsi</option>
              <option value="sgk">Sadece SGK</option>
              <option value="non-sgk">SGK’sız</option>
            </select>
          </div>

          {showSoftDeleteFilter && (
            <SoftDeleteModeFilter
              value={softDeleteMode}
              onChange={setSoftDeleteMode}
              className={focusPatientId ? 'pointer-events-none opacity-60' : ''}
            />
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <input
            type="text"
            placeholder="İsim veya telefon ile ara..."
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={!!focusPatientId}
          />

          <button
            type="button"
            onClick={handleToggleCreateForm}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {showCreateForm ? 'Formu Kapat' : 'Yeni Hasta'}
          </button>
        </div>
      </div>

      <NewPatientFormCard
        open={showCreateForm}
        onToggle={handleToggleCreateForm}
        onSubmit={handleCreateSubmit}
        isSubmitting={createMutation.isPending}
        errorMessage={createMutation.isError ? mutationError : undefined}
      />

      <PatientsTable
        patients={filteredPatients}
        onSelectPatient={handleSelectPatient}
        onDeletePatient={handleDeletePatientFromList}
        onRestorePatient={isAdmin ? handleRestorePatientFromList : undefined}
      />

      {detailPatient && (
        <PatientDetailDrawer
          patient={detailPatient}
          open={true}
          onClose={handleCloseDrawer}
          onSave={(values) =>
            sgkUpdateMutation.mutate({
              id: detailPatient.id,
              sgkFlag: values.sgkFlag,
              sgkPrescriptionReceived: values.sgkPrescriptionReceived,
              sgkRecordedToSystem: values.sgkRecordedToSystem,
              sgkPrescriptionNo: values.sgkPrescriptionNo,
              sgkRecordedToSystemAt: values.sgkRecordedToSystemAt ?? null,
            })
          }
          isSaving={sgkUpdateMutation.isPending}
          errorMsg={(sgkUpdateMutation.error as Error | null | undefined)?.message ?? ''}
          initialTab={detailInitialTab}
          initialShowPlanForm={detailInitialShowPlan}
        />
      )}
    </div>
  );
}
