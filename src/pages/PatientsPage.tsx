// src/pages/PatientsPage.tsx
// Container page for Patients with responsive layout and filters.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PATIENTS_QUERY_KEY,
  fetchPatients,
  updatePatientSgkFields,
} from '../features/patients/api';
import { createPatient } from '../features/patients/api/api.patients';
import { savePatientSaleBreakdown } from '../features/patients/api/api.saleBreakdown';
import { upsertPatientInstallmentPlan } from '../features/patients/api/api.payments';
import { attachDevicesToPatientFromDrafts } from '../features/patients/api/api.devices';
import type {
  NewPatientForm,
  PatientRow,
} from '../features/patients/types';
import {
  NewPatientFormCard,
  PatientDetailDrawer,
  PatientsImportSection,
  PatientsTable,
} from '../features/patients/ui';

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
    // Yeni hasta oluşturma + isteğe bağlı breakdown + senet plan + cihaz zinciri
    mutationFn: async (values: NewPatientForm) => {
      // 1) Hasta kaydı
      const patient = await createPatient(values);

      // 2) Ödeme dağılımı taslağı varsa kaydet
      if (
        values.saleBreakdownDraft &&
        values.saleBreakdownDraft.length > 0
      ) {
        try {
          await savePatientSaleBreakdown({
            patientId: patient.id,
            items: values.saleBreakdownDraft,
          });
        } catch (err) {
          console.error(
            'NewPatient: sale breakdown save error:',
            err,
          );
          // Hasta zaten oluştu; yine de kullanıcıya hata göstermek için
          // mutasyonu hatalı sayıyoruz.
          throw err;
        }
      }

      // 3) Senet plan taslağı varsa kaydet/güncelle
      if (values.installmentPlanDraft) {
        try {
          await upsertPatientInstallmentPlan({
            ...values.installmentPlanDraft,
            patientId: patient.id,
          });
        } catch (err) {
          console.error(
            'NewPatient: installment plan save error:',
            err,
          );
          // Yine: hasta oluşturuldu ama plan kaydı başarısız; hata
          // kullanıcıya yansısın diye yeniden fırlatıyoruz.
          throw err;
        }
      }

      // 4) Cihaz taslakları varsa stok cihazlarını hastaya bağla
      if (values.deviceDrafts && values.deviceDrafts.length > 0) {
        try {
          await attachDevicesToPatientFromDrafts(
            patient.id,
            values.deviceDrafts,
          );
        } catch (err) {
          console.error(
            'NewPatient: attach devices error:',
            err,
          );
          // Hasta oluştu; ancak stok-hasta eşlemesi kritik olduğu için
          // bu hatayı da kullanıcıya gösteriyoruz.
          throw err;
        }
      }

      return patient;
    },
    onSuccess: (createdPatient, variables) => {
      void queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
      setShowCreateForm(false);

      // Yeni hasta Senet ise: detayı otomatik aç, Ödemeler sekmesi + plan formu açık gelsin.
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
      <div className="p-4 text-sm text-slate-500 sm:p-8">
        Hastalar yükleniyor...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-sm text-red-600 sm:p-8">
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
    <div className="space-y-5 px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
      {/* Başlık + sayım */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            Hastalar
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
            Toplam {patients.length} kayıt
          </p>
        </div>
      </div>

      {/* Filtreler + arama + yeni hasta butonu */}
      <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3 shadow-sm sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:space-y-0 sm:bg-slate-50">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* SGK filtresi */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 sm:text-xs">
              SGK filtre:
            </span>
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
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
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

      {/* CSV import bölümü */}
      <PatientsImportSection />

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
              sgkPrescriptionNo: values.sgkPrescriptionNo,
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
