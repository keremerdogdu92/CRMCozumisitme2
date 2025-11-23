// src/pages/PatientsPage.tsx
// Container page for Patients: fetches data, manages filters and orchestrates
// NewPatientFormCard, PatientsTable and PatientDetailDrawer.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PATIENTS_QUERY_KEY,
  fetchPatients,
  createPatient,
  updatePatientSgkFields,
} from '../features/patients/api';
import type {
  NewPatientForm,
  PatientRow,
} from '../features/patients/types';
import { PatientsTable } from '../features/patients/PatientsTable';
import { NewPatientFormCard } from '../features/patients/NewPatientFormCard';
import { PatientDetailDrawer } from '../features/patients/PatientDetailDrawer';

type PatientDetailTabId =
  | 'info'
  | 'devices'
  | 'meetings'
  | 'payments'
  | 'audiogram';

export default function PatientsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sgkFilter, setSgkFilter] = useState<'all' | 'sgk' | 'non-sgk'>(
    'all',
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [detailPatient, setDetailPatient] = useState<PatientRow | null>(
    null,
  );
  const [detailInitialTab, setDetailInitialTab] =
    useState<PatientDetailTabId>('info');
  const [detailInitialShowPlan, setDetailInitialShowPlan] =
    useState<boolean>(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: PATIENTS_QUERY_KEY,
    queryFn: fetchPatients,
  });

  const createMutation = useMutation({
    mutationFn: createPatient,
    onSuccess: (createdPatient, variables) => {
      void queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
      setShowCreateForm(false);

      // If this patient is marked as Senet, directly open their detail
      // on the Payments tab with the plan form expanded.
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

  if (isLoading) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Hastalar yükleniyor...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-sm text-red-600">
        Hasta verileri alınırken bir hata oluştu. Lütfen Supabase
        bağlantısını ve RLS ayarlarını kontrol edin.
      </div>
    );
  }

  const patients = data ?? [];

  const filteredPatients = patients.filter((p) => {
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

  const mutationError =
    (createMutation.error as Error | null | undefined)?.message ?? '';

  const handleToggleCreateForm = () => {
    setShowCreateForm((prev) => !prev);
  };

  const handleCreateSubmit = (values: NewPatientForm) => {
    createMutation.mutate(values);
  };

  const handleSelectPatient = (patient: PatientRow) => {
    setDetailPatient(patient);
    setDetailInitialTab('info');
    setDetailInitialShowPlan(false);
  };

  const handleCloseDrawer = () => {
    setDetailPatient(null);
  };

  return (
    <div className="space-y-6 p-8">
      {/* Başlık + filtreler + arama + yeni hasta butonu */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Hastalar</h2>
          <p className="mt-1 text-xs text-slate-500">
            Toplam {patients.length} kayıt
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* SGK filtresi */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">SGK filtre:</span>
            <select
              value={sgkFilter}
              onChange={(e) =>
                setSgkFilter(
                  e.target.value as 'all' | 'sgk' | 'non-sgk',
                )
              }
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">Hepsi</option>
              <option value="sgk">Sadece SGK</option>
              <option value="non-sgk">SGK’sız</option>
            </select>
          </div>

          {/* Arama */}
          <input
            type="text"
            placeholder="İsim veya telefon ile ara..."
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Yeni hasta butonu */}
          <button
            type="button"
            onClick={handleToggleCreateForm}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {showCreateForm ? 'Formu Kapat' : 'Yeni Hasta'}
          </button>
        </div>
      </div>

      {/* Yeni hasta formu */}
      <NewPatientFormCard
        open={showCreateForm}
        onToggle={handleToggleCreateForm}
        onSubmit={handleCreateSubmit}
        isSubmitting={createMutation.isPending}
        errorMessage={createMutation.isError ? mutationError : undefined}
      />

      {/* Hasta listesi */}
      <PatientsTable
        patients={filteredPatients}
        onSelectPatient={handleSelectPatient}
      />

      {/* Hasta Detay çekmecesi */}
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
            })
          }
          isSaving={sgkUpdateMutation.isPending}
          errorMsg={
            (sgkUpdateMutation.error as Error | null | undefined)
              ?.message ?? ''
          }
          initialTab={detailInitialTab}
          initialShowPlanForm={detailInitialShowPlan}
        />
      )}
    </div>
  );
}
