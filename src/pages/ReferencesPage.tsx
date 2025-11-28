// src/pages/ReferencesPage.tsx
// References page: list, inline create form and detail drawer orchestration.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReferenceNewFormCard } from '../features/references/ReferenceNewFormCard';
import { ReferencesTable } from '../features/references/ReferencesTable';
import { ReferenceDetailDrawer } from '../features/references/ReferenceDetailDrawer';
import {
  fetchReferences,
  createReference,
  REFERENCES_QUERY_KEY,
} from '../features/references/api';
import type {
  NewReferenceForm,
  ReferenceRow,
} from '../features/references/types';
import { useCurrentProfile } from '../features/auth/useCurrentProfile';

const initialFormState: NewReferenceForm = {
  fullName: '',
  group: '',
  phone: '',
  commissionScheme: null,
  commissionPercent: 0,
  commissionFixed: 0,
  contactIntervalDays: '',
  lastMeetAt: '',
  nextMeetAt: '',
  note: '',
  isActive: true,
};

export default function ReferencesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formState, setFormState] = useState<NewReferenceForm>(initialFormState);
  const [detailRef, setDetailRef] = useState<ReferenceRow | null>(null);

  const { data: profile, isLoading: profileLoading } = useCurrentProfile();

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: REFERENCES_QUERY_KEY,
    queryFn: fetchReferences,
  });

  const createMutation = useMutation({
    mutationFn: createReference,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REFERENCES_QUERY_KEY });
      setFormState(initialFormState);
      setShowCreateForm(false);
    },
  });

  const references = data ?? [];

  const filtered = references.filter((r) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;

    return (r.full_name ?? '').toLowerCase().includes(term);
  });

  const mutationError =
    (createMutation.error as Error | null | undefined)?.message ?? '';

  if (profileLoading || isLoading) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Referanslar yükleniyor...
      </div>
    );
  }

  // Only admins can see this page
  if (!profile || profile.role !== 'admin') {
    return (
      <div className="p-8 text-sm text-slate-500">
        Bu sayfa sadece yöneticilere özeldir. Referans listesi, komisyon
        ayarları ve takip hatırlatmalarına yalnızca yönetici hesapları
        erişebilir.
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-sm text-red-600">
        Referans verileri alınırken bir hata oluştu. Lütfen Supabase
        bağlantısını ve RLS ayarlarını kontrol edin.
      </div>
    );
  }

  const totalCount = references.length;

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Referanslar
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Toplam {totalCount} kayıt
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="İsim veya kurum ile ara..."
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {showCreateForm ? 'Formu Kapat' : 'Yeni Referans'}
          </button>
        </div>
      </div>

      {/* New reference form card */}
      {showCreateForm && (
        <ReferenceNewFormCard
          open={showCreateForm}
          onToggle={() => setShowCreateForm((prev) => !prev)}
          values={formState}
          onChange={(patch) =>
            setFormState((prev) => ({
              ...prev,
              ...patch,
            }))
          }
          onSubmit={() =>
            createMutation.mutate({
              ...formState,
            })
          }
          isSubmitting={createMutation.isPending}
          errorMessage={
            createMutation.isError
              ? 'Kayıt sırasında bir hata oluştu. ' +
                (mutationError ? `Detay: ${mutationError}` : '')
              : undefined
          }
        />
      )}

      {/* References table */}
      <ReferencesTable items={filtered} onSelectRow={(r) => setDetailRef(r)} />

      {/* Detail drawer */}
      <ReferenceDetailDrawer
        reference={detailRef}
        open={!!detailRef}
        onClose={() => setDetailRef(null)}
      />
    </div>
  );
}
